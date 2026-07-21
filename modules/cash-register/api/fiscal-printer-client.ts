const BASE_URL = "http://127.0.0.1:8000";

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
  numero_control?: string | null;
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
    return api.request<any>("GET", "/health");
  },

  async getPrinterStatus() {
    return api.request<any>("GET", "/printer/status");
  },

  async createInvoice(payload: FiscalInvoicePayload): Promise<FiscalInvoiceResponse> {
    return api.request("POST", "/invoices", payload);
  },

  async createCreditNote(payload: FiscalCreditNotePayload): Promise<FiscalInvoiceResponse> {
    return api.request("POST", "/credit-notes", payload);
  },

  async reportZ(): Promise<{ command: string; response: Record<string, string | number> }> {
    return api.request("POST", "/reports/z", { confirm: true });
  },
};

export default api;
