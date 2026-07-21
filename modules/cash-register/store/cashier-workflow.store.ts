import { create } from "zustand";
import type { CashierWorkflowState, CashierClosePhysicalCount } from "@/modules/cash-register/types/cashier.types";
import { cashierAccountantService } from "@/modules/cash-register/api/cashier-accountant.service";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import fiscalPrinterClient from "@/modules/cash-register/api/fiscal-printer-client";

interface CashierWorkflowStore extends CashierWorkflowState {
  pharmacyId: string | undefined;
  currentRate: number;
  load: (pharmacyId?: string) => Promise<void>;
  selectCashBox: (id: string | null) => void;
  openSession: () => Promise<void>;
  registerSale: (saleType?: "local" | "digital") => Promise<{ facturacion: any; ordenId: string } | null>;
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

    const order = useCurrentOrderStore.getState().buildModelOrder(profile);
    if (!order) {
      set({ errorMessage: "No hay productos en la orden" });
      return null;
    }

    set({ isSubmitting: true, errorMessage: null });
    try {
      if (saleType === "local") {
        const fiscalPayload = buildFiscalPayload(order);
        const fiscalResult = await fiscalPrinterClient.createInvoice(fiscalPayload);
        const numeroControl = fiscalResult.numero_control;
        if (!numeroControl) {
          set({ isSubmitting: false, errorMessage: "La impresora fiscal no devolvió número de control" });
          return null;
        }
        (order as any).numeroControlInterno = numeroControl;
      }

      const result = await cashierAccountantService.submitOrder(order, saleType, activeSession.id);
      set({ isSubmitting: false, infoMessage: "Venta procesada exitosamente" });
      await get().load();
      return result;
    } catch (error: any) {
      const mensaje = error.response?.data?.message || error.message || "Error al procesar la venta";
      console.error("❌ [registerSale] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
      return null;
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

function mapVatToTaxCode(vat: number): string {
  switch (vat) {
    case 0: return "EXENTO";
    case 8: return "IVA_REDUCIDO";
    case 31: return "IVA_ADICIONAL";
    default: return "IVA_GENERAL";
  }
}

function mapPaymentToFiscal(p: any, rate: number) {
  switch (p.method) {
    case "dollars":
      return { method: "cash" as const, amount: p.amount, currency: "USD" as const, exchange_rate: rate };
    case "card":
      return { method: "card" as const, amount: p.amount };
    case "mobile":
      return { method: "mobile_payment" as const, amount: p.amount, reference: p.reference || "" };
    case "biopago":
      return { method: "other" as const, amount: p.amount, reference: p.reference || "" };
    default:
      return { method: "cash" as const, amount: p.amount, currency: "VES" as const };
  }
}

function buildFiscalPayload(order: any) {
  return {
    customer: {
      name: order.client?.name || "Cliente General",
      document: order.client?.documento || "V-00000000",
      address: order.client?.direccion || "",
    },
    items: order.medications.map((m: any) => ({
      description: m.name || m.description || "",
      quantity: m.quantity,
      unit_price: m.price,
      tax_code: mapVatToTaxCode(m.vat || 16),
      sku: m.barCode || "",
    })),
    payments: order.payments.map((p: any) => mapPaymentToFiscal(p, order.rate || 1)),
    prices_include_tax: false,
    dry_run: false,
  };
}