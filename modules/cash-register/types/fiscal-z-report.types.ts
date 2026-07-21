export interface ZReportCompany {
  razonSocial: string;
  rif: string;
  direccion: string;
  telefono: string;
  email: string;
}

export interface ZReportConsecutiveControl {
  documentoInicial: string;
  documentoFinal: string;
  totalDocumentos: number;
  documentosEsperados: number;
  secuenciaCompleta: boolean;
  numerosFaltantes: string[];
  alertaConsecutivos: boolean;
  mensajeAlerta: string;
}

export interface ZReportSummary {
  nroControlInicial: string;
  nroControlFinal: string;
  totalFacturas: number;
  ventaBase: string;
  ventaIva: string;
  totalVenta: string;
  devolBase: string;
  devolIva: string;
  totalDevol: string;
  totalIgtf: string;
  totalZ: string;
  total: string;
  difZ: string;
}

export interface ZReportOtherDayCancellations {
  base: string;
  iva: string;
  total: string;
  cantidad: number;
}

export interface ZReportAmount {
  ves: number;
  usd: number;
}

export interface ZReportCashRegister {
  id: string | null;
  codigo: string;
  nombre: string;
  montoBaseVes: number;
  montoBaseUsd: number;
  ubicacion: string | null;
  estado: string;
  createdAt: string;
}

export interface ZReportSession {
  id: string | null;
  cajaId: string;
  usuarioAperturaId: string;
  usuarioCierreId: string | null;
  fechaApertura: string;
  fechaCierre: string | null;
  montoAperturaVes: number;
  montoAperturaUsd: number;
  montoCierreFisicoVes: number;
  montoCierreFisicoUsd: number;
  totalVentasVes: number;
  totalVentasUsd: number;
  totalGastosVes: number;
  totalGastosUsd: number;
  diferenciaVes: number;
  diferenciaUsd: number;
  estado: string;
  estadoApertura: string;
  usuarioAprobacionAperturaId: string | null;
  fechaAprobacionApertura: string | null;
  estadoCierre: string | null;
  usuarioAprobacionCierreId: string | null;
  fechaAprobacionCierre: string | null;
  observacionesCierre: string | null;
}

export interface ZReportData {
  empresa: ZReportCompany | null;
  fechaReporte: string;
  controlConsecutivos: ZReportConsecutiveControl | null;
  reporteZ: ZReportSummary | null;
  anulacionesOtrosDias: ZReportOtherDayCancellations | null;
  sucursal: string;
  fecha: string;
  caja: ZReportCashRegister | null;
  fondoInicial: ZReportAmount | null;
  fondoFinal: ZReportAmount | null;
  totalVentas: ZReportAmount | null;
  totalGastos: ZReportAmount | null;
  totalRetirado: ZReportAmount | null;
  diferenciaAcumulada: ZReportAmount | null;
  cantidadTurnos: number;
  detalleSesiones: ZReportSession[];
}

export interface ZReportResponse {
  data: ZReportData | null;
}

export interface ZReportResult {
  success: boolean;
  statusCode: number;
  message: string;
  report: ZReportResponse | null;
  rawPayloadJson: string | null;
  details: string | null;
}

export interface ZReportListItem {
  id: string;
  pharmacyId: string;
  fiscalDate: string;
  zNumber: number | null;
  totalSales: number | null;
  invoiceCount: number | null;
  sucursal: string | null;
}

export interface ZReportListResult {
  success: boolean;
  statusCode: number;
  message: string;
  reports: ZReportListItem[];
}

/** Body para POST /admin/farmacias/{id}/z-reports */
export interface CreateZReportDto {
  z_number: number;
  fiscal_serial: string;
  fiscal_date?: string;
  invoices: {
    count: number;
    doc_from: string;
    doc_to: string;
  };
}

export interface ZReportDocRange {
  count: number;
  total?: number | null;
  docFrom: string;
  docTo: string;
}

/** Respuesta ZReportPresent del backend (campos tolerantes) */
export interface CreatedZReport {
  id: string;
  pharmacyId: string;
  zNumber: number;
  fiscalSerial: string;
  fiscalDate: string;
  totalSales: number | null;
  taxedSales: number | null;
  exemptSales: number | null;
  taxpayers: number | null;
  nonTaxpayers: number | null;
  invoices: ZReportDocRange | null;
  creditNotes: ZReportDocRange | null;
  debitNotes: ZReportDocRange | null;
  taxWithholdingsCount: number | null;
  raw: Record<string, unknown>;
}

export interface CreateZReportResult {
  success: boolean;
  statusCode: number;
  message: string;
  report: CreatedZReport | null;
  details: string | null;
}
