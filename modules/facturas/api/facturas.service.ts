import api from "@/modules/core/api/client";
import type { FacturaListItem, FacturaDetail, FacturaFilters } from "../types";

export const facturasService = {
  async list(filtros: FacturaFilters): Promise<FacturaListItem[]> {
    const response = await api.get("/admin/facturas", { params: filtros });
    const payload = response.data?.data ?? response.data;
    return (Array.isArray(payload) ? payload : []).map(parseFacturaListItem);
  },

  async detail(id: string): Promise<FacturaDetail> {
    const response = await api.get(`/admin/facturas/${id}`);
    const raw = response.data?.data ?? response.data;
    return parseFacturaDetail(raw);
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
    movimientos_caja: {
      moneda: string;
      monto_original: number;
      tasa_cambio?: number;
      metodo_pago: string;
      descripcion?: string;
    }[];
  }): Promise<void> {
    await api.post("/admin/notas-credito", payload);
  },
};

function parseFacturaListItem(raw: any): FacturaListItem {
  return {
    id: raw.id ?? "",
    sesion_caja_id: raw.sesion_caja_id ?? "",
    pharmacy_id: raw.pharmacy_id ?? "",
    usuario_id: raw.usuario_id ?? "",
    numero_control: raw.numero_control ?? "",
    fecha_emision: raw.fecha_emision ?? "",
    cliente_nombre: raw.cliente_nombre ?? "Cliente General",
    cliente_rif: raw.cliente_rif ?? "",
    total_ves: Number(raw.total_ves ?? 0),
    total_usd: Number(raw.total_usd ?? 0),
    tasa_cambio: Number(raw.tasa_cambio ?? 1),
    url_pdf: raw.url_pdf ?? null,
  };
}

function parseFacturaDetail(raw: any): FacturaDetail {
  const f = raw?.factura ?? raw;
  const detalles = raw?.detalles ?? raw?.lines ?? [];
  return {
    id: f.id ?? "",
    sesion_caja_id: f.sesion_caja_id ?? "",
    pharmacy_id: f.pharmacy_id ?? "",
    usuario_id: f.usuario_id ?? "",
    numero_control: f.numero_control ?? "",
    fecha_emision: f.fecha_emision ?? "",
    cliente_nombre: f.cliente_nombre ?? "Cliente General",
    cliente_rif: f.cliente_rif ?? "",
    total_ves: Number(f.total_ves ?? 0),
    total_usd: Number(f.total_usd ?? 0),
    tasa_cambio: Number(f.tasa_cambio ?? 1),
    base_imponible_ves: Number(f.base_imponible_ves ?? 0),
    iva_porcentaje: Number(f.iva_porcentaje ?? 0),
    iva_monto_ves: Number(f.iva_monto_ves ?? 0),
    url_pdf: f.url_pdf ?? null,
    observaciones: f.observaciones ?? null,
    detalles: Array.isArray(detalles)
      ? detalles.map((d: any) => ({
          id: d.id ?? "",
          factura_id: d.factura_id ?? "",
          descripcion: d.descripcion ?? "",
          cantidad: Number(d.cantidad ?? 0),
          precio_unitario_ves: Number(d.precio_unitario_ves ?? 0),
          iva_porcentaje: Number(d.iva_porcentaje ?? 0),
          subtotal_ves: Number(d.subtotal_ves ?? 0),
        }))
      : [],
  };
}
