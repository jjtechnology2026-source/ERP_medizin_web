import api from "@/modules/core/api/client";
import { getSession } from "next-auth/react";
import axios from "axios";
import type {
  CashierCashBox,
  CashierSession,
  CashierInvoice,
  CashierInvoiceDetail,
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

function parsePaymentMethod(metodoPago: any): string {
  if (typeof metodoPago === "string") return metodoPago;
  if (typeof metodoPago === "object" && metodoPago !== null) {
    return Object.keys(metodoPago)[0] || "";
  }
  return "";
}

function parseCurrency(moneda: any): "VES" | "USD" {
  if (typeof moneda === "string") return moneda.toUpperCase() === "USD" ? "USD" : "VES";
  if (typeof moneda === "object" && moneda !== null) {
    const key = Object.keys(moneda)[0] || "";
    return key.toUpperCase() === "USD" ? "USD" : "VES";
  }
  return "VES";
}

function parseInvoiceDetail(raw: any): CashierInvoiceDetail {
  const f = raw?.factura ?? raw;
  return {
    id: f.id ?? f._id ?? "",
    controlNumber: f.numero_control ?? f.controlNumber ?? "",
    emittedAt: f.fecha_emision ?? f.emittedAt ?? null,
    clientName: f.cliente_nombre ?? f.clientName ?? "Cliente General",
    clientRif: f.cliente_rif ?? f.clientRif ?? "V-00000000",
    clientDocType: f.cliente_tipo_documento ?? f.clientDocType ?? "",
    clientDoc: f.cliente_documento ?? f.clientDoc ?? "",
    baseImponibleVes: Number(f.base_imponible_ves ?? f.baseImponibleVes ?? 0),
    totalExentoVes: Number(f.total_exento_ves ?? 0),
    ivaPorcentaje: Number(f.iva_porcentaje ?? f.ivaPorcentaje ?? 0),
    ivaMontoVes: Number(f.iva_monto_ves ?? f.ivaMontoVes ?? 0),
    igtfMontoVes: f.igtf_monto_ves ?? f.igtfMontoVes ?? null,
    totalVes: Number(f.total_ves ?? f.totalVes ?? 0),
    totalUsd: Number(f.total_usd ?? f.totalUsd ?? 0),
    exchangeRate: f.tasa_cambio ?? f.exchangeRate ?? null,
    pdfUrl: f.url_pdf ?? f.pdfUrl ?? null,
    observaciones: f.observaciones ?? null,
    retencionAplicada: f.retencion_aplicada ?? f.retencionAplicada ?? null,
    ivaRetenidoClienteVes: f.iva_retenido_cliente_ves ?? f.ivaRetenidoClienteVes ?? null,
    ivaAPagarEmpresaVes: f.iva_a_pagar_empresa_ves ?? f.ivaAPagarEmpresaVes ?? null,
    lines: Array.isArray(raw.detalles ?? raw.lines)
      ? (raw.detalles ?? raw.lines).map((l: any) => ({
          id: l.id ?? l._id ?? "",
          description: l.descripcion ?? l.description ?? "",
          quantity: Number(l.cantidad ?? l.quantity ?? 0),
          unitPriceVes: Number(l.precio_unitario_ves ?? l.unitPriceVes ?? 0),
          vatPercentage: Number(l.iva_porcentaje ?? l.vatPercentage ?? 0),
          subtotalVes: Number(l.subtotal_ves ?? l.subtotalVes ?? 0),
          productoId: l.producto_id ?? l.productoId ?? undefined,
          discount: l.discount ?? undefined,
        }))
      : [],
    transaccion: raw.transaccion
      ? {
          id: raw.transaccion.id ?? raw.transaccion._id ?? "",
          tipo: raw.transaccion.tipo ?? "",
          metodoPago: raw.transaccion.metodo_pago ?? raw.transaccion.metodoPago ?? "",
          moneda: raw.transaccion.moneda ?? "",
          montoOriginal: Number(raw.transaccion.monto_original ?? raw.transaccion.montoOriginal ?? 0),
          montoVes: Number(raw.transaccion.monto_ves ?? raw.transaccion.montoVes ?? 0),
          tasaCambio: raw.transaccion.tasa_cambio ?? raw.transaccion.tasaCambio ?? null,
          descripcion: raw.transaccion.descripcion ?? null,
          fechaHora: raw.transaccion.fecha_hora ?? raw.transaccion.fechaHora ?? "",
        }
      : null,
  };
}

function parseTransaction(raw: any): CashierTransaction {
  const tipoStr = typeof raw.tipo === "object" && raw.tipo !== null
    ? Object.keys(raw.tipo)[0] || ""
    : raw.tipo ?? raw.type ?? "";
  const typeVal = tipoStr.toLowerCase();
  let type: CashierTransaction["type"] = "unknown";
  if (typeVal === "venta" || typeVal === "sale") type = "sale";
  else if (typeVal === "gasto" || typeVal === "expense") type = "expense";
  else if (typeVal === "devolucion" || typeVal === "refund") type = "refund";

  return {
    id: raw.id ?? raw._id ?? "",
    type,
    description: raw.descripcion ?? raw.description ?? "",
    currency: parseCurrency(raw.moneda ?? raw.currency ?? "VES"),
    paymentMethod: parsePaymentMethod(raw.metodo_pago ?? raw.paymentMethod ?? ""),
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
  try {
    const now = new Date();
    const formattedDate = `${now.getFullYear().toString().padStart(4, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
    const { data } = await axios.post("/api/proxy", {
      url: "/Rate",
      method: "GET",
      data: { Moneda: "USD", Fechavalor: formattedDate },
      headers: { "Content-Type": "application/json" },
    });
    const rate = Number(data?.tipocambio) || 0;
    if (rate > 0) return rate;
    console.warn("❌ [fetchCurrentRate] /Rate returned 0");
  } catch (e: any) {
    console.error("❌ [fetchCurrentRate] /Rate failed:", e.response?.data || e.message);
  }

  return 0;
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

  /** Envía la orden a /orders/local o /insertorder según el tipo */
  async submitOrder(order: Record<string, any>, saleType: "local" | "digital" = "local", sesionCajaId?: string): Promise<{
    facturacion: { success: boolean; numeroControl: string | null; urlPdf: string | null; error: string | null };
    ordenId: string;
  }> {
    const baseUrl = saleType === "digital" ? "/admin/Orders/insertorder" : "/admin/Orders/orders/local";
    const url = sesionCajaId ? `${baseUrl}?sesion_caja_id=${encodeURIComponent(sesionCajaId)}` : baseUrl;
    const { data } = await api.post(url, [order]);
    const result = Array.isArray(data) ? data[0] : data;
    const fac = result?.facturacion ?? {};
    return {
      facturacion: {
        success: fac?.success ?? false,
        numeroControl: fac?.numeroControl ?? fac?.numero_control ?? fac?.resp?.numerocontrol ?? null,
        urlPdf: fac?.resp?.urlpdf ?? fac?.url_pdf ?? null,
        error: fac?.error ?? null,
      },
      ordenId: result?.id ?? result?.idOrder ?? "",
    };
  },

  async fetchInvoiceDetail(id: string): Promise<CashierInvoiceDetail> {
    const { data } = await api.get(`/admin/facturas/${id}`);
    return parseInvoiceDetail(data?.data ?? data);
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

  buildControlNumber(prefix = "FAC"): string {
    return `${prefix}-${Date.now()}`;
  },
};