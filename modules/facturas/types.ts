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
  total_ves: number;
  total_usd: number;
  tasa_cambio: number;
  base_imponible_ves: number;
  iva_porcentaje: number;
  iva_monto_ves: number;
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

export interface FacturaFilters {
  pharmacy_id: string;
  search?: string;
  numero_control?: string;
  cliente_rif?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}
