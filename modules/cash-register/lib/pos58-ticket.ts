// Builder ESC/POS de comprobantes "No Fiscal" (58 mm / 32 columnas).
// Funcion PURA: recibe datos ya calculados (montos vienen de money.ts en el call
// site) y devuelve bytes ESC/POS. Sin I/O, sin React, sin red. Texto normalizado
// a ASCII (sin acentos) y sin logo/QR (solo texto).
//
// Documentos: factura/venta, nota de credito, reporte Z, reporte X.

export interface TicketHeader {
  name: string;
  rif: string;
}

export interface TicketItem {
  qty: number;
  description: string;
  amount: number;
}

export interface TicketMoneyLine {
  label: string;
  amount: number;
}

export const WIDTH = 32;

const INIT = [0x1b, 0x40];

function concat(parts: number[][]): Uint8Array {
  const out: number[] = [];
  for (const p of parts) out.push(...p);
  return Uint8Array.from(out);
}

export const ESC = {
  init: () => Uint8Array.from(INIT),
  align: (n: 0 | 1 | 2) => Uint8Array.from([0x1b, 0x61, n]),
  style: (n: number) => Uint8Array.from([0x1b, 0x21, n]),
  feed: (n: number) => Uint8Array.from([0x1b, 0x64, n]),
  cut: () => Uint8Array.from([0x1d, 0x56, 0x00]),
};

/** Texto -> bytes latin1, quitando diacriticos; no-latin1 -> '?'. */
export function latin1(s: string): number[] {
  const normalized = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const out: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.charCodeAt(i);
    out.push(c > 0xff ? 0x3f : c);
  }
  return out;
}

export function line(s = ""): number[] {
  return [...latin1(s), 0x0a];
}

export function row(left: string, right: string): string {
  const gap = Math.max(1, WIDTH - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`;
}

export function separator(): string {
  return "-".repeat(WIDTH);
}

/** Parte un texto en lineas de a `width` columnas (por palabras y hard-break). */
export function wrapText(s: string, width: number): string[] {
  const w = Math.max(1, Math.floor(width));
  const out: string[] = [];
  let cur = "";
  for (const word of s.split(" ")) {
    if (cur.length === 0) {
      cur = word;
    } else if (cur.length + 1 + word.length <= w) {
      cur += " " + word;
    } else {
      out.push(cur);
      cur = word;
    }
  }
  if (cur.length > 0 || out.length === 0) out.push(cur);
  return out.flatMap((p) => (p.length <= w ? [p] : (p.match(new RegExp(`.{1,${w}}`, "g")) ?? [p])));
}

/** Fila con importe a la derecha; si no entra, la descripcion hace wrap. */
function amountLine(desc: string, amount: number): number[][] {
  const amt = fmtMoney(amount);
  const lines = wrapText(desc, WIDTH - amt.length - 1);
  if (lines.length <= 1) return [line(row(desc, amt))];
  const out: number[][] = [];
  for (let i = 0; i < lines.length - 1; i++) out.push(line(lines[i]));
  out.push(line(row(lines[lines.length - 1], amt)));
  return out;
}

/** Fila etiqueta/valor; si el valor no entra, baja a su propia linea indentada. */
function fieldLine(label: string, value: string): number[][] {
  if (label.length + value.length + 1 <= WIDTH) return [line(row(label, value))];
  return [line(`${label}:`), ...wrapText(value, WIDTH - 2).map((l) => line(`  ${l}`))];
}

export function fmtMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const [int, dec] = Math.abs(v).toFixed(2).split(".");
  const withThousands = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withThousands},${dec}`;
}

// --- Secciones compartidas ---

function headerBlock(h: TicketHeader, title: string): number[][] {
  return [
    [...ESC.init()],
    [...ESC.align(1), ...ESC.style(0x10), ...line(h.name), ...ESC.style(0)],
    line(`RIF: ${h.rif}`),
    line(""),
    [...ESC.style(0x08), ...line(title), ...ESC.style(0)],
    [...ESC.align(0), ...line(separator())],
  ];
}

function footerBlock(legend: string): number[][] {
  return [
    line(separator()),
    [...ESC.align(1), ...ESC.style(0x08), ...line(`** ${legend} **`), ...ESC.style(0)],
    line("Documento sin validez fiscal"),
    line(""),
    [...ESC.feed(4)],
  ];
}

// --- Factura / venta ---

export interface SaleTicketData {
  header: TicketHeader;
  title: string;
  controlNumber: string;
  date: string;
  customerName: string;
  customerDoc: string;
  items: TicketItem[];
  totals: TicketMoneyLine[];
  total: number;
  payments: TicketMoneyLine[];
  change?: number;
  legend: string;
}

export function buildSaleTicket(d: SaleTicketData): Uint8Array {
  const parts: number[][] = [
    ...headerBlock(d.header, d.title),
    line(`Control Nro: ${d.controlNumber}`),
    line(`Fecha: ${d.date}`),
    line(`Cliente: ${d.customerName}`),
    line(`C.I./RIF: ${d.customerDoc}`),
    line(separator()),
  ];
  for (const it of d.items) {
    parts.push(...amountLine(`${it.qty} x ${it.description}`, it.amount));
  }
  parts.push(line(separator()));
  for (const t of d.totals) parts.push(line(row(t.label, fmtMoney(t.amount))));
  parts.push([...ESC.align(1), ...ESC.style(0x18), ...line(`TOTAL Bs ${fmtMoney(d.total)}`), ...ESC.style(0), ...ESC.align(0)]);
  parts.push(line(separator()), line("Formas de pago:"));
  for (const p of d.payments) parts.push(line(row(`  ${p.label}`, fmtMoney(p.amount))));
  if (d.change && d.change > 0) parts.push(line(row("  Vuelto", fmtMoney(d.change))));
  parts.push(...footerBlock(d.legend));
  return concat(parts);
}

// --- Nota de credito ---

export interface CreditNoteTicketData {
  header: TicketHeader;
  title: string;
  controlNumber: string;
  trackingId: string;
  date: string;
  customerName: string;
  customerDoc: string;
  affectedDoc: string;
  reason?: string;
  items?: TicketItem[];
  total: number;
  legend: string;
}

export function buildCreditNoteTicket(d: CreditNoteTicketData): Uint8Array {
  const parts: number[][] = [
    ...headerBlock(d.header, d.title),
    line(`Control Nro: ${d.controlNumber}`),
    line(`Tracking: ${d.trackingId}`),
    line(`Fecha: ${d.date}`),
    line(`Cliente: ${d.customerName}`),
    line(`C.I./RIF: ${d.customerDoc}`),
    line(`Afecta: ${d.affectedDoc}`),
    line(separator()),
  ];
  if (d.items && d.items.length > 0) {
    for (const it of d.items) {
      parts.push(...amountLine(`${it.qty} x ${it.description}`, it.amount));
    }
    parts.push(line(separator()));
  }
  if (d.reason) parts.push(line(`Motivo: ${d.reason}`));
  parts.push([...ESC.align(1), ...ESC.style(0x18), ...line(`TOTAL Bs ${fmtMoney(d.total)}`), ...ESC.style(0), ...ESC.align(0)]);
  parts.push(...footerBlock(d.legend));
  return concat(parts);
}

// --- Reporte Z / X ---

export interface ReportTicketData {
  header: TicketHeader;
  title: string; // "REPORTE Z NO FISCAL" | "REPORTE X NO FISCAL"
  date: string;
  fields: { label: string; value: string }[];
  totals: TicketMoneyLine[];
  /** Desglose por metodo de pago (efectivo Bs, dolares, tarjeta, pago movil, biopago). */
  paymentBreakdown?: TicketMoneyLine[];
  total?: number;
  legend: string;
}

export function buildReportTicket(d: ReportTicketData): Uint8Array {
  const parts: number[][] = [...headerBlock(d.header, d.title), line(`Fecha: ${d.date}`), line(separator())];
  for (const f of d.fields) parts.push(...fieldLine(f.label, f.value));
  if (d.totals.length > 0) {
    parts.push(line(separator()));
    for (const t of d.totals) parts.push(line(row(t.label, fmtMoney(t.amount))));
  }
  if (d.paymentBreakdown && d.paymentBreakdown.length > 0) {
    parts.push(line(separator()), line("Por metodo de pago:"));
    for (const p of d.paymentBreakdown) parts.push(line(row(`  ${p.label}`, fmtMoney(p.amount))));
  }
  if (typeof d.total === "number") {
    parts.push([...ESC.align(1), ...ESC.style(0x18), ...line(`TOTAL Bs ${fmtMoney(d.total)}`), ...ESC.style(0), ...ESC.align(0)]);
  }
  parts.push(...footerBlock(d.legend));
  return concat(parts);
}
