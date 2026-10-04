export interface Medication {
  brand: string;
  activeIngredient: string;
  dosage: string;
  tablets: string;
  barCode: string;
  name: string;
  image: string;
  category: string;
  subcategory: string;
  price: number;
  quantity: number;
  stock: number;
  description: string;
  controlled: boolean;
  vat?: number;
  antibiotic: boolean;
  minimum: number;
  discount?: number;
}

export interface Client {
  id: string;
  documento: string;
  name: string;
  email: string;
  direccion: string;
  phone: string;
  retencion?: string;
  tipo_documento?: string;
}

export interface CashPaymentData { amount: number; currency?: { VES?: Record<string, never> } }
export interface DollarsPaymentData { amount: number }
export interface CardPaymentData { amount: number; punto?: string; type?: string; reference?: string }
export interface MobilePaymentData { amount: number; reference?: string; bank?: string }
export interface BiopagoPaymentData { amount: number; reference?: string; bank?: string }

export type Payment =
  | { Cash: CashPaymentData }
  | { Dollars: DollarsPaymentData }
  | { Card: CardPaymentData }
  | { Mobile: MobilePaymentData }
  | { Biopago: BiopagoPaymentData };

export interface Facturacion {
  success: boolean;
  numero_control: string | null;
  numeroControl?: string | null;
  resp: {
    numerointerno: string;
    numerocontrol: string;
    trackingid: string;
    urlpdf: string;
    fecha: string;
    serie: string | null;
  } | null;
  error: any;
}

export interface PipelineFailure {
  stage: string;
  reasonCode: string;
  applied: number;
  compensated: boolean;
  diverged: boolean;
  attempts: number;
  attemptedAt: string;
  /** The failed attempt could not be resolved: stock may or may not be applied. */
  outcomeUnknown?: boolean;
}

/** Machine codes the backend returns in the `refusal` field of a 404/409. */
export type ReprocessRefusalCode =
  | "order_not_found"
  | "evidence_absent"
  | "partial_application"
  | "sale_movement_exists"
  | "application_unverifiable"
  | "application_proven_applied"
  | "outcome_unknown";

export interface ReprocessRefusalBody {
  error: string;
  refusal: ReprocessRefusalCode;
}

export interface Order {
  date: string;
  id: string;
  nameGroup: string;
  idAgent: string;
  nameAgent: string;
  idPharmacy: string;
  idGroup: string;
  medications: Medication[];
  totalreal: number;
  totalsystem: number;
  rifEmisor: string;
  client: Client;
  payments: Payment[];
  rate: number;
  gender: string;
  saleStatus: "Pending" | "Paid" | "Completed" | "Cancelled" | "PipelineFailed";
  numeroControlInterno?: string | null;
  pipelineFailure?: PipelineFailure | null;
  isControlled: boolean;
  saleType: string;
  address: string;
  pharmacy: string;
  facturacion: Facturacion;
  notaCredito?: any;
  notaDebito?: any;
  observation?: string | null;
}