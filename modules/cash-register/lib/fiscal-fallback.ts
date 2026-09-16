// Fallback fiscal "No Fiscal": cuando la facturacion digital falla (transporte,
// success=false, error o numeroControl ausente) se sintetizan los campos NO
// monetarios y se persiste por los endpoints existentes. Los montos NUNCA se
// tocan aqui: el total del documento sale de money.ts (fiscalItemsTotal/toBs2),
// igual que buildFiscalPayload, para no introducir una segunda matematica.

import { toBs2, fiscalItemsTotal } from "./money.ts";

export const NO_FISCAL_LEGEND = "No Fiscal";
export const FALLBACK_NOTE_ERROR = "No Fiscal fallback";

const FALLBACK_Z_STORAGE_KEY = "no-fiscal-z-reports";

export interface FiscalFailure {
  success?: boolean | null;
  numeroControl?: string | null;
  error?: unknown;
}

// null/undefined = la llamada lanzo (error de transporte). Se trata como fallo.
export function isFiscalFailure(fac?: FiscalFailure | null): boolean {
  if (!fac) return true;
  if (fac.success === false) return true;
  if (fac.error) return true;
  if (fac.numeroControl == null) return true;
  return false;
}

export function synthesizeFiscalNumber(prefix = "NF"): string {
  const n = Math.floor(Math.random() * 1e12)
    .toString()
    .padStart(12, "0");
  return `${prefix}${n}`;
}

export function synthesizeTrackingId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `nf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface FallbackInvoice {
  numeroControl: string;
  trackingid: string;
  serie: string;
  fecha: string;
  urlpdf: null;
  total: number;
}

// Mismos items que buildFiscalPayload (precio Bs = round2(usd * rate)) para que
// el total coincida con fiscalItemsTotal. no tocar montos.
export function buildFallbackInvoice(
  order: { medications: Array<{ quantity: number; price: number }>; rate?: number },
  now: Date = new Date(),
): FallbackInvoice {
  const rate = order.rate || 1;
  const items = (order.medications || []).map((m) => ({
    quantity: m.quantity,
    unit_price: toBs2(m.price * rate),
  }));
  return {
    numeroControl: synthesizeFiscalNumber(),
    trackingid: synthesizeTrackingId(),
    serie: "NF",
    fecha: now.toISOString(),
    urlpdf: null,
    total: fiscalItemsTotal(items),
  };
}

export function applyFallbackInvoiceToOrder<
  T extends { numeroControlInterno?: unknown; facturacion?: unknown },
>(order: T, invoice: FallbackInvoice): T {
  const existing = (order.facturacion ?? {}) as Record<string, unknown>;
  return {
    ...order,
    numeroControlInterno: invoice.numeroControl,
    facturacion: {
      ...existing,
      success: true,
      numeroControl: invoice.numeroControl,
      trackingid: invoice.trackingid,
      serie: invoice.serie,
      fecha: invoice.fecha,
      urlpdf: null,
      fallback: true,
    },
  } as T;
}

export interface FallbackZInvoiceLine {
  quantity?: number;
  unitPriceVes?: number;
  vatPercentage?: number;
  subtotalVes?: number;
}

export interface FallbackZInvoice {
  controlNumber?: string;
  totalVes?: number;
  lines?: FallbackZInvoiceLine[];
}

export interface FallbackZReport {
  z_number: number;
  fiscal_serial: string;
  fiscal_date: string;
  invoices: { count: number; doc_from: string; doc_to: string } | null;
  credit_notes: null;
  debit_notes: null;
  taxpayers: number;
  non_taxpayers: number;
  tax_withholdings_count: number;
  total_sales: number;
  /** Base imponible de lineas gravadas (sin IVA). */
  taxed_sales: number;
  /** IVA de las lineas gravadas. */
  iva_monto: number;
  exempt_sales: number;
  /** IGTF = total − (base + IVA + exento). */
  igtf_monto: number;
  fallback: true;
}

export function buildFallbackZReport(input?: {
  sessionInvoices?: FallbackZInvoice[];
  pharmacyId?: string;
  now?: Date;
}): FallbackZReport {
  const now = input?.now ?? new Date();
  const invoices = input?.sessionInvoices ?? [];
  const fiscal_date = now.toISOString().slice(0, 10);
  const z_number = Number(`${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`);

  const first = invoices.find((i) => i.controlNumber);
  const last = [...invoices].reverse().find((i) => i.controlNumber);
  const total_sales = fiscalItemsTotal(
    invoices.map((i) => ({ quantity: 1, unit_price: toBs2(i.totalVes || 0) })),
  );

  // Base/IVA/exento reales por linea (si vienen); si no, todo gravado.
  let base = 0;
  let iva = 0;
  let exento = 0;
  for (const inv of invoices) {
    for (const l of inv.lines ?? []) {
      const sub = toBs2(l.subtotalVes ?? (Number(l.quantity) || 0) * (Number(l.unitPriceVes) || 0));
      const pct = Number(l.vatPercentage) || 0;
      if (pct > 0) {
        base += sub;
        iva += toBs2(sub * (pct / 100));
      } else {
        exento += sub;
      }
    }
  }
  base = toBs2(base);
  iva = toBs2(iva);
  exento = toBs2(exento);
  if (toBs2(base + iva + exento) === 0) {
    base = total_sales;
    iva = 0;
    exento = 0;
  }
  const igtf = Math.max(0, toBs2(total_sales - toBs2(base + iva + exento)));

  return {
    z_number,
    fiscal_serial: `${input?.pharmacyId || "NF"}-${fiscal_date}-${z_number}`,
    fiscal_date,
    invoices: invoices.length
      ? {
          count: invoices.length,
          doc_from: first?.controlNumber || "",
          doc_to: last?.controlNumber || "",
        }
      : null,
    credit_notes: null,
    debit_notes: null,
    taxpayers: invoices.length,
    non_taxpayers: 0,
    tax_withholdings_count: 0,
    total_sales,
    taxed_sales: base,
    iva_monto: iva,
    exempt_sales: exento,
    igtf_monto: igtf,
    fallback: true,
  };
}

export interface FallbackNote {
  numero_control: string;
  tracking_id: string;
  url_pdf: null;
  fecha: string;
  fiscal_success: false;
  fiscal_error: string;
}

export function buildFallbackNote(now: Date = new Date()): FallbackNote {
  return {
    numero_control: synthesizeFiscalNumber(),
    tracking_id: synthesizeTrackingId(),
    url_pdf: null,
    fecha: now.toISOString(),
    fiscal_success: false,
    fiscal_error: FALLBACK_NOTE_ERROR,
  };
}

export interface FallbackZMarker {
  pharmacyId: string;
  fiscalDate: string;
  zNumber: number;
}

function zMarkerKey(marker: FallbackZMarker): string {
  return `${marker.pharmacyId}|${marker.fiscalDate}|${marker.zNumber}`;
}

function readRegistry(
  storage?: Pick<Storage, "getItem" | "setItem">,
): string[] {
  const s =
    storage ??
    (typeof localStorage !== "undefined" ? localStorage : undefined);
  if (!s) return [];
  try {
    const raw = s.getItem(FALLBACK_Z_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Registro local por navegador (limite conocido: no se comparte entre equipos).
export function recordFallbackZ(
  marker: FallbackZMarker,
  storage?: Pick<Storage, "getItem" | "setItem">,
): void {
  const s =
    storage ??
    (typeof localStorage !== "undefined" ? localStorage : undefined);
  if (!s) return;
  const list = readRegistry(s);
  const key = zMarkerKey(marker);
  if (!list.includes(key)) {
    list.push(key);
    s.setItem(FALLBACK_Z_STORAGE_KEY, JSON.stringify(list));
  }
}

export function isFallbackZ(
  marker: FallbackZMarker,
  storage?: Pick<Storage, "getItem" | "setItem">,
): boolean {
  return readRegistry(storage).includes(zMarkerKey(marker));
}
