import { create } from "zustand";
import type { CashierWorkflowState, CashierClosePhysicalCount } from "@/modules/cash-register/types/cashier.types";
import { cashierAccountantService } from "@/modules/cash-register/api/cashier-accountant.service";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import fiscalPrinterClient from "@/modules/cash-register/api/fiscal-printer-client";
import { buildFiscalPayload } from "@/modules/cash-register/lib/fiscal-payload";
import { reconcileFiscalTotal } from "@/modules/cash-register/lib/money";
import { isFiscalFailure } from "@/modules/cash-register/lib/fiscal-fallback";
import { runOrderFallback } from "@/modules/cash-register/lib/fiscal-fallback-flow";
import { printNoFiscalTicket } from "@/modules/cash-register/lib/pos58-print";

interface CashierWorkflowStore extends CashierWorkflowState {
  pharmacyId: string | undefined;
  currentRate: number;
  load: (pharmacyId?: string) => Promise<void>;
  selectCashBox: (id: string | null) => void;
  openSession: () => Promise<void>;
  registerSale: (saleType?: "local" | "digital") => Promise<{ facturacion: any; ordenId: string; fiscalFallback?: boolean; printError?: string } | null>;
  checkFiscalHealth: () => Promise<void>;
  requestCloseSession: (
    physicalCount: CashierClosePhysicalCount,
    options?: { observations?: string; openNewTurn?: boolean; nextCashierId?: string }
  ) => Promise<void>;
  issueCreditNote: (invoiceId: string, reason: string) => Promise<void>;
  clearMessages: () => void;
  setError: (msg: string | null) => void;
  setInfo: (msg: string | null) => void;
}

const initialState: CashierWorkflowState & { currentRate: number } = {
  isLoading: false,
  isSubmitting: false,
  isCashierRole: true,
  cashBoxes: [],
  activeSession: null,
  sessionInvoices: [],
  sessionTransactions: [],
  selectedCashBoxId: null,
  errorMessage: null,
  infoMessage: null,
  currentRate: 0,
  fiscalAvailable: null,
};

export const useCashierWorkflowStore = create<CashierWorkflowStore>((set, get) => ({
  ...initialState,
  pharmacyId: undefined,

  load: async (pharmacyId?: string) => {
    const effectivePharmacyId = pharmacyId || get().pharmacyId;
    if (!effectivePharmacyId) {
      set({ isLoading: false, errorMessage: "No se pudo determinar la farmacia" });
      return;
    }

    set({ isLoading: true, errorMessage: null, pharmacyId: effectivePharmacyId });

    const rate = useCurrencyStore.getState().getEffectiveRate();
    set({ currentRate: rate });

    const [cashBoxes, rawSession] = await Promise.all([
      (async () => {
        try {
          return await cashierAccountantService.fetchCashBoxes(effectivePharmacyId);
        } catch (e: any) {
          console.error("❌ [Store load] fetchCashBoxes failed:", e.response?.data || e.message);
          return [];
        }
      })(),
      (async () => {
        try {
          return await cashierAccountantService.fetchActiveSession();
        } catch (e: any) {
          console.error("❌ [Store load] fetchActiveSession failed:", e.response?.data || e.message);
          return null;
        }
      })(),
    ]);

    const activeSession = rawSession && (rawSession.id || rawSession.cashBoxId) ? rawSession : null;

    let sessionInvoices: any[] = [];
    let sessionTransactions: any[] = [];

    if (activeSession && activeSession.approvalStatus === "approved") {
      const [inv, tx] = await Promise.all([
        (async () => {
          try {
            return await cashierAccountantService.fetchSessionInvoices(activeSession.cashBoxId);
          } catch (e: any) {
            console.error("❌ [Store load] fetchSessionInvoices failed:", e.response?.data || e.message);
            return [];
          }
        })(),
        (async () => {
          try {
            return await cashierAccountantService.fetchSessionTransactions(activeSession.cashBoxId);
          } catch (e: any) {
            console.error("❌ [Store load] fetchSessionTransactions failed:", e.response?.data || e.message);
            return [];
          }
        })(),
      ]);
      sessionInvoices = inv;
      sessionTransactions = tx;
    }

    set({
      isLoading: false,
      cashBoxes,
      activeSession,
      sessionInvoices,
      sessionTransactions,
      selectedCashBoxId: activeSession?.cashBoxId ?? cashBoxes[0]?.id ?? null,
    });
  },

  selectCashBox: (id) => set({ selectedCashBoxId: id }),

  openSession: async () => {
    const { selectedCashBoxId } = get();
    if (!selectedCashBoxId) {
      set({ errorMessage: "Selecciona una caja primero" });
      return;
    }
    set({ isSubmitting: true, errorMessage: null });
    try {
      await cashierAccountantService.openSession(selectedCashBoxId);
      set({
        isSubmitting: false,
        infoMessage: "Apertura enviada. Debe ser aprobada antes de cobrar.",
      });
      await get().load();
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al solicitar apertura de caja";
      console.error("❌ [openSession] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
    }
  },

  registerSale: async (saleType: "local" | "digital" = "local") => {
    const { activeSession } = get();
    if (!activeSession?.id) {
      set({ errorMessage: "No hay sesión de caja activa" });
      return null;
    }

    const profile = useAuthStore.getState().profile;
    if (!profile) {
      set({ errorMessage: "No hay perfil de usuario" });
      return null;
    }

    const header = {
      name: String(profile.pharmacyName || profile.name_group || profile.name || ""),
      rif: String(profile.rif || ""),
    };

    const order = useCurrentOrderStore.getState().buildModelOrder(profile);
    if (!order) {
      set({ errorMessage: "No hay productos en la orden" });
      return null;
    }

    set({ isSubmitting: true, errorMessage: null });
    try {
      // Fallback "No Fiscal": imprime en la POS58 y persiste la venta. Es el
      // unico camino cuando la fiscal no puede emitir el comprobante.
      const runFallback = async () => {
        const outcome = await runOrderFallback({
          header,
          order,
          initialResult: null,
          transportFailed: true,
          saleType,
          sessionId: activeSession.id,
          submitOrder: cashierAccountantService.submitOrder,
          print: printNoFiscalTicket,
        });
        set({ isSubmitting: false, infoMessage: "Venta procesada como No Fiscal" });
        await get().load();
        return outcome;
      };

      if (saleType === "local") {
        // /health verificado como caido al abrir el pago: la fiscal no puede
        // emitir, directo a No Fiscal sin intentar (sin falsos positivos).
        // ponytail: si el servicio esta vivo pero la fiscal imprime y no confirma,
        // ya no hay guard anti-duplicado; agregarlo si aparecen duplicados.
        if (get().fiscalAvailable === false) return await runFallback();

        const fiscalPayload = buildFiscalPayload(order);
        let fiscalResult: Awaited<ReturnType<typeof fiscalPrinterClient.createInvoice>> | null = null;
        try {
          fiscalResult = await fiscalPrinterClient.createInvoice(fiscalPayload);
        } catch (error: any) {
          const mensaje = error.response?.data?.detail || error.response?.data?.message || error.message || "Error al procesar la venta";
          console.error("❌ [registerSale] Error fiscal local:", mensaje);
          // La fiscal fallo (rechazo/void, o servicio caido a mitad de venta): No Fiscal.
          return await runFallback();
        }
        // 200 sin numero de control: la fiscal no emitio COO -> No Fiscal.
        if (!fiscalResult?.fiscal_number) return await runFallback();

        const recon = reconcileFiscalTotal(fiscalResult.total, fiscalPayload.items);
        if (recon) {
          order.observaciones = order.observaciones ? `${order.observaciones} ${recon}` : recon;
        }
        order.numeroControlInterno = fiscalResult.fiscal_number;
        const result = await cashierAccountantService.submitOrder(order, "local", activeSession.id);
        set({ isSubmitting: false, infoMessage: "Venta procesada exitosamente" });
        await get().load();
        return result;
      }

      let result: Awaited<ReturnType<typeof cashierAccountantService.submitOrder>> | null = null;
      let transportFailed = false;
      try {
        result = await cashierAccountantService.submitOrder(order, saleType, activeSession.id);
      } catch (error) {
        transportFailed = true;
        console.error(
          "❌ [registerSale] Error fiscal digital:",
          error instanceof Error ? error.message : "Error de transporte",
        );
      }

      // Exito real del canal digital: respondio con numero de control.
      if (!transportFailed && !isFiscalFailure(result?.facturacion)) {
        set({ isSubmitting: false, infoMessage: "Venta procesada exitosamente" });
        await get().load();
        return result;
      }

      // Fallback "No Fiscal": los montos no se tocan; solo se sintetizan los
      // campos fiscales. Se persiste por el endpoint existente y solo se
      // reintenta cuando la llamada original fallo por transporte.
      const outcome = await runOrderFallback({
        header,
        order,
        initialResult: result,
        transportFailed,
        saleType,
        sessionId: activeSession.id,
        submitOrder: cashierAccountantService.submitOrder,
        print: printNoFiscalTicket,
      });

      set({ isSubmitting: false, infoMessage: "Venta procesada como No Fiscal" });
      await get().load();
      return outcome;
    } catch (error: any) {
      const mensaje = error.response?.data?.message || error.message || "Error al procesar la venta";
      console.error("❌ [registerSale] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
      return null;
    }
  },

  checkFiscalHealth: async () => {
    try {
      const health = await fiscalPrinterClient.getHealth();
      set({ fiscalAvailable: health?.status === "ok" });
    } catch {
      set({ fiscalAvailable: false });
    }
  },

  requestCloseSession: async (physicalCount, options = {}) => {
    const { activeSession } = get();
    if (!activeSession) {
      set({ errorMessage: "No hay sesión activa" });
      return;
    }
    set({ isSubmitting: true, errorMessage: null });
    try {
      await cashierAccountantService.requestCloseSession({
        caja_id: activeSession.cashBoxId,
        conteo_fisico: physicalCount,
        observaciones: options.observations,
        abrir_nuevo_turno: options.openNewTurn ?? false,
        nuevo_cajero_id: options.nextCashierId,
      });
      set({
        isSubmitting: false,
        infoMessage: "Cierre solicitado exitosamente",
        activeSession: null,
      });
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al solicitar cierre";
      console.error("❌ [requestCloseSession] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
    }
  },

  issueCreditNote: async (invoiceId, reason) => {
    const { activeSession } = get();
    if (!activeSession) return;
    set({ isSubmitting: true });
    try {
      const invoice = get().sessionInvoices.find((i) => i.id === invoiceId);
      if (!invoice) throw new Error("Factura no encontrada");

      await cashierAccountantService.createCreditNote({
        factura_id: invoiceId,
        sesion_caja_id: activeSession.id,
        numero_control: cashierAccountantService.buildControlNumber("NC"),
        motivo: reason,
        tasa_cambio: invoice.exchangeRate || 1,
        detalles: invoice.lines.map((l) => ({
          detalle_factura_id: l.id,
          descripcion: l.description,
          cantidad: l.quantity,
          precio_unitario_ves: l.unitPriceVes,
          iva_porcentaje: l.vatPercentage,
        })),
        movimientos_caja: [{ moneda: "VES", monto_original: invoice.totalVes, metodo_pago: "EFECTIVO" }],
      });
      set({ isSubmitting: false, infoMessage: "Nota de crédito emitida" });
      await get().load();
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al emitir nota de crédito";
      set({ isSubmitting: false, errorMessage: mensaje });
    }
  },

  clearMessages: () => set({ errorMessage: null, infoMessage: null }),
  setError: (msg) => set({ errorMessage: msg }),
  setInfo: (msg) => set({ infoMessage: msg }),
}));
