import api from "@/modules/core/api/client";
import { getSession } from "next-auth/react";
import axios from "axios";
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
    baseAmountVes: Number(
      raw.monto_base_ves ?? raw.base_amount_ves ?? raw.baseAmountVes ?? 0
    ),
    baseAmountUsd: Number(
      raw.monto_base_usd ?? raw.base_amount_usd ?? raw.baseAmountUsd ?? 0
    ),
    status: raw.status ?? raw.estado ?? "",
  };
}

function parseSession(raw: any, saldoTeorico?: any): CashierSession {
  return {
    id: raw.id ?? raw._id ?? "",
    cashBoxId: raw.caja_id ?? raw.cashBoxId ?? "",
    cashBoxName: raw.caja_nombre ?? raw.cashBoxName ?? "",
    pharmacyId: raw.pharmacy_id ?? raw.pharmacyId ?? "",
    openingAmountVes: Number(raw.monto_apertura_ves ?? raw.openingAmountVes ?? 0),
    openingAmountUsd: Number(raw.monto_apertura_usd ?? raw.openingAmountUsd ?? 0),
    theoreticalAmountVes: Number(
      saldoTeorico?.ves ?? raw.monto_teorico_ves ?? raw.theoreticalAmountVes ?? 0
    ),
    theoreticalAmountUsd: Number(
      saldoTeorico?.usd ?? raw.monto_teorico_usd ?? raw.theoreticalAmountUsd ?? 0
    ),
    closingPhysicalAmountVes: Number(raw.monto_cierre_fisico_ves ?? raw.closingPhysicalAmountVes ?? 0),
    closingPhysicalAmountUsd: Number(raw.monto_cierre_fisico_usd ?? raw.closingPhysicalAmountUsd ?? 0),
    differenceVes: Number(raw.diferencia_ves ?? raw.differenceVes ?? 0),
    differenceUsd: Number(raw.diferencia_usd ?? raw.differenceUsd ?? 0),
    openedByUserId: raw.usuario_apertura_id ?? raw.openedByUserId ?? "",
    openedAt: raw.fecha_apertura ?? raw.openedAt ?? null,
    status: raw.estado ?? raw.status ?? "",
    approvalStatus: normalizeApprovalStatus(
      raw.estado_apertura ?? raw.approvalStatus ?? ""
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
      params: {
        pharmacy_id: pharmacyId,
        incluir_inactivas: false,
      },
    });
    const items = Array.isArray(data) ? data : data?.data ?? data?.cajas ?? [];
    return items.map(parseCashBox);
  },

  async fetchActiveSession(cashBoxId?: string): Promise<CashierSession | null> {
    const response = await api.get("/admin/sesiones/activa", {
      params: cashBoxId ? { caja_id: cashBoxId } : undefined,
    });
    const payload = response.data?.data;
    if (!payload || !payload.sesion) return null;

    const sessionRaw = payload.sesion;
    const saldoTeorico = payload.saldo_teorico ?? {};

    return parseSession(sessionRaw, saldoTeorico);
  },

async fetchCurrentRate(): Promise<number> {
  const response = await api.get("/admin/tasas/actual");
  const payload = response.data?.data ?? response.data;
  return Number(payload?.tasa ?? payload?.rate ?? payload?.valor ?? 0);
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
    const response = await api.get("/admin/facturas/sesion-actual", {
      params: cashBoxId ? { caja_id: cashBoxId } : undefined,
    });
    const payload = response.data?.data ?? response.data;
    const items = Array.isArray(payload) ? payload : payload?.facturas ?? [];
    return items.map(parseInvoice);
  },

  async fetchSessionTransactions(cashBoxId?: string): Promise<CashierTransaction[]> {
    const response = await api.get("/admin/transacciones/sesion-actual", {
      params: cashBoxId ? { caja_id: cashBoxId } : undefined,
    });
    const payload = response.data?.data ?? response.data;
    const items = Array.isArray(payload) ? payload : payload?.transacciones ?? [];
    return items.map(parseTransaction);
  },

  async fetchNextCashiers(pharmacyId: string): Promise<{ id: string; name: string }[]> {
    const response = await api.get(
      `/admin/Agent/search_agent_names_by_pharmacy/${pharmacyId}`
    );
    const payload = response.data?.data ?? response.data;
    const items = Array.isArray(payload) ? payload : payload?.agentes ?? [];
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