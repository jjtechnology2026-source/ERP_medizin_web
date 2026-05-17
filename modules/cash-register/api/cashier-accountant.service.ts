import api from "@/modules/core/api/client";
import type {
  CashierCashBox,
  CashierSession,
  CashierInvoice,
  CashierTransaction,
  CreateInvoicePayload,
  CloseSessionPayload,
} from "@/modules/cash-register/types/cashier.types";

function normalizeApprovalStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "pendiente" || s === "pending") return "pending";
  if (s === "aprobada" || s === "aprobado" || s === "approved") return "approved";
  if (s === "rechazada" || s === "rechazado" || s === "rejected") return "rejected";
  return "unknown";
}

function parseCashBox(raw: any): CashierCashBox {
  return {
    id: raw.id ?? raw._id ?? "",
    code: raw.code ?? raw.codigo ?? "",
    name: raw.name ?? raw.nombre ?? "",
    location: raw.location ?? raw.ubicacion ?? "",
    pharmacyId: raw.pharmacy_id ?? raw.pharmacyId ?? raw.id_farmacia ?? "",
    baseAmountVes: Number(raw.base_amount_ves ?? raw.baseAmountVes ?? 0),
    baseAmountUsd: Number(raw.base_amount_usd ?? raw.baseAmountUsd ?? 0),
    status: raw.status ?? raw.estado ?? "",
  };
}

function parseSession(raw: any): CashierSession {
  return {
    id: raw.id ?? raw._id ?? "",
    cashBoxId: raw.caja_id ?? raw.cashBoxId ?? "",
    cashBoxName: raw.caja_nombre ?? raw.cashBoxName ?? "",
    pharmacyId: raw.pharmacy_id ?? raw.pharmacyId ?? "",
    openingAmountVes: Number(raw.monto_apertura_ves ?? raw.openingAmountVes ?? 0),
    openingAmountUsd: Number(raw.monto_apertura_usd ?? raw.openingAmountUsd ?? 0),
    theoreticalAmountVes: Number(raw.monto_teorico_ves ?? raw.theoreticalAmountVes ?? 0),
    theoreticalAmountUsd: Number(raw.monto_teorico_usd ?? raw.theoreticalAmountUsd ?? 0),
    closingPhysicalAmountVes: Number(raw.conteo_fisico_ves ?? raw.closingPhysicalAmountVes ?? 0),
    closingPhysicalAmountUsd: Number(raw.conteo_fisico_usd ?? raw.closingPhysicalAmountUsd ?? 0),
    differenceVes: Number(raw.diferencia_ves ?? raw.differenceVes ?? 0),
    differenceUsd: Number(raw.diferencia_usd ?? raw.differenceUsd ?? 0),
    openedByUserId: raw.abierto_por ?? raw.openedByUserId ?? "",
    openedAt: raw.fecha_apertura ?? raw.openedAt ?? null,
    status: raw.status ?? raw.estado ?? "",
    approvalStatus: normalizeApprovalStatus(
      raw.estado_aprobacion ?? raw.approvalStatus ?? ""
    ) as CashierSession["approvalStatus"],
  };
}

function parseInvoice(raw: any): CashierInvoice {
  return {
    id: raw.id ?? raw._id ?? "",
    controlNumber: raw.numero_control ?? raw.controlNumber ?? "",
    clientName: raw.cliente_nombre ?? raw.clientName ?? "Cliente General",
    clientRif: raw.cliente_rif ?? raw.clientRif ?? "V-00000000",
    totalVes: Number(raw.total_ves ?? raw.totalVes ?? 0),
    exchangeRate: Number(raw.tasa_cambio ?? raw.exchangeRate ?? 1),
    emittedAt: raw.fecha_emision ?? raw.emittedAt ?? null,
    pdfUrl: raw.url_pdf ?? raw.pdfUrl ?? "",
    pharmacyId: raw.pharmacy_id ?? raw.pharmacyId ?? "",
    lines: Array.isArray(raw.detalles ?? raw.lines)
      ? (raw.detalles ?? raw.lines).map((l: any) => ({
          id: l.id ?? l._id ?? "",
          description: l.descripcion ?? l.description ?? "",
          quantity: Number(l.cantidad ?? l.quantity ?? 0),
          unitPriceVes: Number(l.precio_unitario_ves ?? l.unitPriceVes ?? 0),
          vatPercentage: Number(l.iva_porcentaje ?? l.vatPercentage ?? 0),
        }))
      : [],
  };
}

function parseTransaction(raw: any): CashierTransaction {
  const typeVal = (raw.tipo ?? raw.type ?? "").toLowerCase();
  let type: CashierTransaction["type"] = "unknown";
  if (typeVal === "venta" || typeVal === "sale") type = "sale";
  else if (typeVal === "gasto" || typeVal === "expense") type = "expense";
  else if (typeVal === "devolucion" || typeVal === "refund") type = "refund";

  return {
    id: raw.id ?? raw._id ?? "",
    type,
    description: raw.descripcion ?? raw.description ?? "",
    currency: (raw.moneda ?? raw.currency ?? "VES").toUpperCase() === "USD" ? "USD" : "VES",
    paymentMethod: raw.metodo_pago ?? raw.paymentMethod ?? "",
    originalAmount: Number(raw.monto_original ?? raw.originalAmount ?? 0),
    amountVes: Number(raw.monto_ves ?? raw.amountVes ?? 0),
    occurredAt: raw.fecha ?? raw.occurredAt ?? null,
    voided: Boolean(raw.anulado ?? raw.voided ?? false),
  };
}

export const cashierAccountantService = {
  async fetchCashBoxes(pharmacyId?: string): Promise<CashierCashBox[]> {
    const { data } = await api.get("/admin/cajas", {
      params: { pharmacy_id: pharmacyId, incluir_inactivas: false },
    });
    const items = Array.isArray(data) ? data : data?.data ?? data?.cajas ?? [];
    return items.map(parseCashBox);
  },

  async fetchActiveSession(cashBoxId?: string): Promise<CashierSession | null> {
    const { data } = await api.get("/admin/sesiones/activa", {
      params: cashBoxId ? { caja_id: cashBoxId } : undefined,
    });
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    return parseSession(data);
  },

  async fetchCurrentRate(): Promise<number> {
    const { data } = await api.get("/admin/tasas/actual");
    return Number(data?.tasa ?? data?.rate ?? data ?? 0);
  },

  async openSession(cashBoxId: string): Promise<void> {
    await api.post("/admin/sesiones/apertura", { caja_id: cashBoxId });
  },

  async requestCloseSession(payload: CloseSessionPayload): Promise<void> {
    await api.post("/admin/sesiones/cierre", payload);
  },

  async createInvoiceFromOrder(payload: CreateInvoicePayload): Promise<CashierInvoice> {
    const { data } = await api.post("/admin/facturas", payload);
    return parseInvoice(data?.factura ?? data);
  },

  async fetchSessionInvoices(cashBoxId?: string): Promise<CashierInvoice[]> {
    const { data } = await api.get("/admin/facturas/sesion-actual", {
      params: cashBoxId ? { caja_id: cashBoxId } : undefined,
    });
    const items = Array.isArray(data) ? data : data?.data ?? data?.facturas ?? [];
    return items.map(parseInvoice);
  },

  async fetchSessionTransactions(cashBoxId?: string): Promise<CashierTransaction[]> {
    const { data } = await api.get("/admin/transacciones/sesion-actual", {
      params: cashBoxId ? { caja_id: cashBoxId } : undefined,
    });
    const items = Array.isArray(data) ? data : data?.data ?? data?.transacciones ?? [];
    return items.map(parseTransaction);
  },

  async fetchNextCashiers(pharmacyId: string): Promise<{ id: string; name: string }[]> {
    const { data } = await api.get(
      `/admin/Agent/search_agent_names_by_pharmacy/${pharmacyId}`
    );
    const items = Array.isArray(data) ? data : data?.data ?? data?.agentes ?? [];
    return items.map((a: any) => ({
      id: a.id ?? a._id ?? "",
      name: a.name ?? a.nombre ?? "",
    }));
  },

  async createCreditNote(payload: {
    factura_id: string;
    sesion_caja_id: string;
    numero_control: string;
    motivo: string;
    tasa_cambio: number;
    observaciones?: string;
    detalles: {
      detalle_factura_id: string;
      descripcion: string;
      cantidad: number;
      precio_unitario_ves: number;
      iva_porcentaje: number;
    }[];
  }): Promise<CashierInvoice> {
    const { data } = await api.post("/admin/notas-credito", payload);
    return parseInvoice(data?.nota ?? data);
  },

  async createDebitNote(payload: {
    factura_id: string;
    sesion_caja_id: string;
    numero_control: string;
    motivo: string;
    tasa_cambio: number;
    observaciones?: string;
    detalles: {
      detalle_factura_id: string;
      descripcion: string;
      cantidad: number;
      precio_unitario_ves: number;
      iva_porcentaje: number;
    }[];
  }): Promise<CashierInvoice> {
    const { data } = await api.post("/admin/notas-debito", payload);
    return parseInvoice(data?.nota ?? data);
  },

  buildControlNumber(prefix = "FAC"): string {
    return `${prefix}-${Date.now()}`;
  },
};
