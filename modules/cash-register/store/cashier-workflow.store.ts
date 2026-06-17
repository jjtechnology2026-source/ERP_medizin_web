import { create } from "zustand";
import type { CashierWorkflowState, CashierClosePhysicalCount } from "@/modules/cash-register/types/cashier.types";
import type { CreateInvoicePayload } from "@/modules/cash-register/types/cashier.types";
import { cashierAccountantService } from "@/modules/cash-register/api/cashier-accountant.service";

interface CashierWorkflowStore extends CashierWorkflowState {
  pharmacyId: string | undefined;
  load: (pharmacyId?: string) => Promise<void>;
  selectCashBox: (id: string | null) => void;
  openSession: () => Promise<void>;
  registerSale: (payload: CreateInvoicePayload) => Promise<void>;
  requestCloseSession: (
    physicalCount: CashierClosePhysicalCount,
    options?: { observations?: string; openNewTurn?: boolean; nextCashierId?: string }
  ) => Promise<void>;
  issueCreditNote: (invoiceId: string, reason: string) => Promise<void>;
  issueDebitNote: (invoiceId: string, reason: string) => Promise<void>;
  clearMessages: () => void;
  setError: (msg: string | null) => void;
  setInfo: (msg: string | null) => void;
}

const initialState: CashierWorkflowState = {
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

  registerSale: async (payload) => {
    set({ isSubmitting: true, errorMessage: null });
    try {
      await cashierAccountantService.createInvoiceFromOrder(payload);
      set({ isSubmitting: false, infoMessage: "Factura emitida exitosamente" });
      await get().load(); // ahora recuerda el pharmacyId
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al emitir factura";
      console.error("❌ [registerSale] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
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
      });
      set({ isSubmitting: false, infoMessage: "Nota de crédito emitida" });
      await get().load();
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al emitir nota de crédito";
      set({ isSubmitting: false, errorMessage: mensaje });
    }
  },

  issueDebitNote: async (invoiceId, reason) => {
    const { activeSession } = get();
    if (!activeSession) return;
    set({ isSubmitting: true });
    try {
      const invoice = get().sessionInvoices.find((i) => i.id === invoiceId);
      if (!invoice) throw new Error("Factura no encontrada");

      await cashierAccountantService.createDebitNote({
        factura_id: invoiceId,
        sesion_caja_id: activeSession.id,
        numero_control: cashierAccountantService.buildControlNumber("ND"),
        motivo: reason,
        tasa_cambio: invoice.exchangeRate || 1,
        detalles: invoice.lines.map((l) => ({
          detalle_factura_id: l.id,
          descripcion: l.description,
          cantidad: l.quantity,
          precio_unitario_ves: l.unitPriceVes,
          iva_porcentaje: l.vatPercentage,
        })),
      });
      set({ isSubmitting: false, infoMessage: "Nota de débito emitida" });
      await get().load();
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al emitir nota de débito";
      set({ isSubmitting: false, errorMessage: mensaje });
    }
  },

  clearMessages: () => set({ errorMessage: null, infoMessage: null }),
  setError: (msg) => set({ errorMessage: msg }),
  setInfo: (msg) => set({ infoMessage: msg }),
}));