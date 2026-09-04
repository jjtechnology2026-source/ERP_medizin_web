const BASE_URL = "http://127.0.0.1:8000";

export type FiscalBrand = "hka80" | "bematech";

export interface FiscalSerialPort {
  device: string;
  description: string;
  fiscal?: boolean;
}

// Marca activa: decide si se usan las rutas raíz (hka80) o /bematech/*.
// Se inicializa desde localStorage para que todos los consumidores del
// singleton (store, dialogs) enruten a la misma marca sin coordinación.
let activeBrand: FiscalBrand = "hka80";

export function setFiscalBrand(brand: FiscalBrand): void {
  activeBrand = brand;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("fiscal-implementation", brand);
  }
}

export function getFiscalBrand(): FiscalBrand {
  return activeBrand;
}

function brandPrefix(): string {
  return activeBrand === "bematech" ? "/bematech" : "";
}

if (typeof window !== "undefined") {
  const stored = window.localStorage.getItem("fiscal-implementation");
  if (stored === "hka80" || stored === "bematech") {
    activeBrand = stored;
  }
}

export interface FiscalCustomer {
  name: string;
  document: string;
  address?: string;
  phone?: string;
}

export interface FiscalInvoiceItem {
  description: string;
  quantity: number | string;
  unit_price: number | string;
  tax_code: "EXENTO" | "IVA_GENERAL" | "IVA_REDUCIDO" | "IVA_ADICIONAL" | "PERCIBIDO";
  sku?: string;
  discount_amount?: number | string;
}

export interface FiscalPayment {
  method: "cash" | "card" | "transfer" | "mobile_payment" | "other";
  amount: number | string;
  currency?: "VES" | "USD";
  exchange_rate?: number | string;
  reference?: string;
}

export interface FiscalInvoicePayload {
  customer: FiscalCustomer;
  items: FiscalInvoiceItem[];
  payments: FiscalPayment[];
  prices_include_tax?: boolean;
  invoice_number?: string;
  notes?: string;
  dry_run?: boolean;
}

export interface FiscalCreditNotePayload extends FiscalInvoicePayload {
  affected_fiscal_number: string;
  affected_invoice_date?: string;
  reason?: string;
}

export interface FiscalInvoiceResponse {
  status: string;
  total: number;
  dry_run: boolean;
  commands: Array<{
    command: string;
    frame_hex: string;
    response: Record<string, string | number>;
    data?: string | null;
  }>;
  planned_commands: string[];
  message?: string | null;
  fiscal_number?: string | null;
}

export interface FiscalReportZResponse {
  printed: boolean;
  print_error?: string | null;
  command?: string | null;
  frame_hex?: string | null;
  response?: Record<string, string | number> | null;
  z_number?: number | null;
  fiscal_serial?: string | null;
  report?: Record<string, unknown>;
}

export interface FiscalReportXResponse {
  command: string;
  frame_hex: string;
  response: Record<string, string | number>;
  data?: string | null;
}

const api = {
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(detail.detail || `Fiscal printer error: ${res.status}`);
    }
    return res.json();
  },

  async getHealth() {
    return api.request<any>("GET", `${brandPrefix()}/health`);
  },

  async setSerialPort(serialPort: string): Promise<{ status: string; serial_port: string }> {
    return api.request("PUT", `${brandPrefix()}/config/serial-port`, { serial_port: serialPort });
  },

  async listSerialPorts(): Promise<{ ports: FiscalSerialPort[] }> {
    return api.request("GET", `${brandPrefix()}/config/serial-ports`);
  },

  async getPrinterStatus() {
    return api.request<any>("GET", `${brandPrefix()}/printer/status`);
  },

  async createInvoice(payload: FiscalInvoicePayload): Promise<FiscalInvoiceResponse> {
    return api.request("POST", `${brandPrefix()}/invoices`, payload);
  },

  async createCreditNote(payload: FiscalCreditNotePayload): Promise<FiscalInvoiceResponse> {
    return api.request("POST", `${brandPrefix()}/credit-notes`, payload);
  },

  async reportZ(): Promise<FiscalReportZResponse> {
    return api.request("POST", `${brandPrefix()}/reports/z`, { confirm: true });
  },

  async reportX(): Promise<FiscalReportXResponse> {
    return api.request("POST", `${brandPrefix()}/reports/x`);
  },

  async forceUpdate(): Promise<{ status: string; version: string }> {
    return api.request("POST", "/update");
  },
};

export default api;
