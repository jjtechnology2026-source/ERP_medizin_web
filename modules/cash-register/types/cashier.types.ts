export type CashierApprovalStatus = "pending" | "approved" | "rejected" | "unknown";
export type CashierTransactionType = "sale" | "expense" | "refund" | "unknown";
export type PaymentMethod = "efectivo" | "dolares" | "tarjeta" | "pagomovil" | "biopago";

export interface CashierCashBox {
  id: string;
  code: string;
  name: string;
  location: string;
  pharmacyId: string;
  baseAmountVes: number;
  baseAmountUsd: number;
  status: string;
}

export interface CashierSession {
  id: string;
  cashBoxId: string;
  cashBoxName: string;
  pharmacyId: string;
  openingAmountVes: number;
  openingAmountUsd: number;
  theoreticalAmountVes: number;
  theoreticalAmountUsd: number;
  closingPhysicalAmountVes: number;
  closingPhysicalAmountUsd: number;
  differenceVes: number;
  differenceUsd: number;
  openedByUserId: string;
  openedAt: string | null;
  status: string;
  approvalStatus: CashierApprovalStatus;
}

export interface CashierInvoice {
  id: string;
  controlNumber: string;
  clientName: string;
  clientRif: string;
  totalVes: number;
  exchangeRate: number;
  emittedAt: string | null;
  pdfUrl: string;
  pharmacyId: string;
  lines: CashierInvoiceLine[];
}

export interface CashierInvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceVes: number;
  vatPercentage: number;
  subtotalVes?: number;
  productoId?: string;
}

export interface CashierInvoiceDetail {
  id: string;
  controlNumber: string;
  emittedAt: string | null;
  clientName: string;
  clientRif: string;
  clientDocType: string;
  clientDoc: string;
  baseImponibleVes: number;
  totalExentoVes: number;
  ivaPorcentaje: number;
  ivaMontoVes: number;
  igtfMontoVes: number | null;
  totalVes: number;
  totalUsd: number;
  exchangeRate: number | null;
  pdfUrl: string | null;
  observaciones: string | null;
  retencionAplicada: number | null;
  ivaRetenidoClienteVes: number | null;
  ivaAPagarEmpresaVes: number | null;
  lines: CashierInvoiceLine[];
  transaccion: CashierPaymentTransaction | null;
}

export interface CashierPaymentTransaction {
  id: string;
  tipo: string;
  metodoPago: string;
  moneda: string;
  montoOriginal: number;
  montoVes: number;
  tasaCambio: number | null;
  descripcion: string | null;
  fechaHora: string;
}

export interface CashierTransaction {
  id: string;
  type: CashierTransactionType;
  description: string;
  currency: "VES" | "USD";
  paymentMethod: string;
  originalAmount: number;
  amountVes: number;
  occurredAt: string | null;
  voided: boolean;
}

export interface CashierClosePhysicalCount {
  efectivo_ves: number;
  tarjeta_ves: number;
  otros_ves: number;
  efectivo_usd: number;
  tarjeta_usd: number;
  otros_usd: number;
}

export interface CashPayment {
  type: "efectivo";
  amount: number;
  change: number;
}

export interface DollarPayment {
  type: "dolares";
  amount: number;
  change: number;
}

export interface CardPayment {
  type: "tarjeta";
  amount: number;
  punto: string;
  cardType: string;
  reference: string;
}

export interface MobilePayment {
  type: "pagomovil";
  amount: number;
  reference: string;
  bank: string;
}

export interface BiopagoPayment {
  type: "biopago";
  amount: number;
  reference: string;
  bank: string;
}

export type Payment = CashPayment | DollarPayment | CardPayment | MobilePayment | BiopagoPayment;

export interface CashierWorkflowState {
  isLoading: boolean;
  isSubmitting: boolean;
  isCashierRole: boolean;
  cashBoxes: CashierCashBox[];
  activeSession: CashierSession | null;
  sessionInvoices: CashierInvoice[];
  sessionTransactions: CashierTransaction[];
  selectedCashBoxId: string | null;
  errorMessage: string | null;
  infoMessage: string | null;
}

export interface CreateInvoicePayload {
  sesion_caja_id: string;
  numero_control: string;
  cliente_nombre: string;
  cliente_rif: string;
  tasa_cambio: number;
  observaciones?: string;
  detalles: {
    producto_id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_ves: number;
    iva_porcentaje: number;
  }[];
  movimiento_caja?: {
    moneda: string;
    monto_original: number;
    tasa_cambio?: number;
    metodo_pago: string;
    descripcion: string;
  };
}

export interface CloseSessionPayload {
  caja_id: string;
  conteo_fisico: CashierClosePhysicalCount;
  observaciones?: string;
  abrir_nuevo_turno: boolean;
  nuevo_cajero_id?: string;
}
