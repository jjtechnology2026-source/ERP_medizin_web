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
  vat: number;
  antibiotic: boolean;
  minimum: number;
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
  resp: {
    numerointerno: string;
    numerocontrol: string;
    trackingid: string;
    urlpdf: string;
    fecha: string;
  } | null;
  error: any;
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
  saleStatus: "Completed" | "Pending" | "Cancelled";
  isControlled: boolean;
  saleType: string;
  address: string;
  pharmacy: string;
  facturacion: Facturacion;
  notaCredito?: any;
  notaDebito?: any;
  observation?: string | null;
}