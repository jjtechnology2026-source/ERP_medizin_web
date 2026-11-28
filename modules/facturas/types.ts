export interface FacturaListItem {
  id: string;
  sesion_caja_id: string;
  pharmacy_id: string;
  usuario_id: string;
  numero_control: string;
  fecha_emision: string;
  cliente_nombre: string;
  cliente_rif: string;
  total_ves: number;
  total_usd: number;
  tasa_cambio: number;
  url_pdf: string | null;
  /**
   * Clase fiscal del comprobante que emitió el backend. Ausente en las filas
   * viejas, que son fiscales; `"no_fiscal"` identifica el modo `simple`.
   */
  tipo_comprobante?: "fiscal" | "no_fiscal" | null;
}

export interface FacturaDetail {
  id: string;
  sesion_caja_id: string;
  pharmacy_id: string;
  usuario_id: string;
  numero_control: string;
  fecha_emision: string;
  cliente_nombre: string;
  cliente_rif: string;
  cliente_correo?: string | null;
  cliente_direccion?: string | null;
  serie_fiscal?: string | null;
  total_ves: number;
  total_usd: number;
  tasa_cambio: number;
  base_imponible_ves: number;
  total_exento_ves: number;
  iva_porcentaje: number;
  iva_monto_ves: number;
  igtf_monto_ves: number;
  url_pdf: string | null;
  observaciones: string | null;
  detalles: FacturaDetalleItem[];
  transacciones: FacturaTransaccion[];
}

export interface FacturaTransaccion {
  id: string;
  tipo: string;
  metodo_pago: string;
  moneda: string;
  monto_original: number;
  monto_ves: number;
  tasa_cambio: number | null;
  descripcion: string | null;
  fecha_hora: string;
}

export interface FacturaDetalleItem {
  id: string;
  factura_id: string;
  producto_id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario_ves: number;
  iva_porcentaje: number;
  subtotal_ves: number;
}

export interface NotaCreditoResumen {
  id: string;
  factura_id: string;
  numero_control: string;
  fecha_emision: string;
  motivo: string;
  total_ves: number;
  total_usd: number;
}

/**
 * Document state the invoice list can filter by on a phone.
 *
 * `FacturaListItem` carries no status column (`facturas.service.ts:129-144`), so
 * the only state the screen can read without touching the service is whether the
 * invoice already has a credit note. `all` is the default and the only value
 * reachable from `lg` up, so desktop keeps listing exactly what it lists today.
 */
export type FacturaEstadoFilter = "all" | "con-nc" | "sin-nc";

export interface FacturaFilters {
  pharmacy_id: string;
  search?: string;
  numero_control?: string;
  cliente_rif?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}
