export interface FiscalNoteItem {
  descripcion: string;
  codigo_plu: string;
  cantidad: number;
  precio_unitario: number;
  vat: number;
  es_exento: boolean;
}

export interface FiscalNoteCliente {
  rif: string;
  razon_social: string;
  direccion: string;
  telefono: string;
  correo: string;
}

export interface FiscalNoteDocumentoAfectado {
  numero_documento: string;
  fecha_emision: string;
  monto_total: number;
  motivo: string;
}

export interface FiscalNoteCreateRequest {
  id_pharmacy: string;
  entidad?: string;
  tasa_cambio: number;
  rif_emisor: string;
  tracking_id: string;
  numero_control_interno: string;
  cliente: FiscalNoteCliente;
  documento_afectado: FiscalNoteDocumentoAfectado;
  items: FiscalNoteItem[];
  id_order?: string;
  sesion_caja_id?: string;
  factura_id?: string;
}

export interface FiscalNoteResponse {
  success: boolean;
  numero_control: string | null;
  tracking_id: string | null;
  url_pdf: string | null;
  fecha: string | null;
  error: string | null;
}

export interface FiscalNoteDetail {
  id: string | null;
  numero_control: string;
  numero_interno?: string | null;
  tracking_id?: string | null;
  url_pdf?: string | null;
  fecha_emision?: string | null;
  motivo?: string | null;
  base_imponible_ves: number;
  iva_porcentaje: number;
  iva_monto_ves: number;
  total_ves: number;
  total_usd: number;
  tasa_cambio?: number | null;
  observaciones?: string | null;
  order_id?: string | null;
  factura_id?: string | null;
  pharmacy_id?: string | null;
  fiscal_success?: boolean | null;
  fiscal_error?: string | null;
}

export interface FiscalNotesFilter {
  order_id?: string;
  pharmacy_id?: string;
  search?: string;
  numero_control?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}
