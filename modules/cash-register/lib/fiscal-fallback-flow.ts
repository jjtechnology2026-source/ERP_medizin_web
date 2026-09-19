// Orquestacion del fallback "No Fiscal" (detectar -> sintetizar -> imprimir ->
// reintentar persistir), con las llamadas externas inyectadas para poder
// cubrirla sin React/DOM/red. Los montos NUNCA se calculan aqui: vienen de
// money.ts a traves de fiscal-fallback.ts. Cada call site decide cuando hay
// fallo y solo llama a estos helpers en ese caso.
//
// El comprobante se imprime en la POS80 (WebUSB) con cabecera = nombre de la
// farmacia + RIF, y desglose de pagos SIEMPRE en Bs (divisa convertida por tasa).

import {
  buildFallbackInvoice,
  applyFallbackInvoiceToOrder,
  buildFallbackZReport,
  buildFallbackNote,
  type FallbackNote,
  type FallbackZMarker,
  type FallbackZReport,
  type FallbackZInvoice,
} from "./fiscal-fallback.ts";
import { toBs2 } from "./money.ts";
import type { NoFiscalTicket, NoFiscalPrintResult } from "./pos58-print.ts";
import type { TicketHeader, TicketMoneyLine } from "./pos58-ticket.ts";
import type { CreateZReportDto } from "@/modules/cash-register/types/fiscal-z-report.types";

export type PrintFn = (ticket: NoFiscalTicket) => Promise<NoFiscalPrintResult>;

const NO_FISCAL = "NO FISCAL";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo Bs",
  efectivo: "Efectivo Bs",
  dollars: "Efectivo USD",
  dolares: "Efectivo USD",
  card: "Tarjeta",
  tarjeta: "Tarjeta",
  tarjetadebito: "Tarjeta Debito",
  tarjeta_debito: "Tarjeta Debito",
  tarjetacredito: "Tarjeta Credito",
  tarjeta_credito: "Tarjeta Credito",
  mobile: "Pago Movil",
  pagomovil: "Pago Movil",
  pago_movil: "Pago Movil",
  biopago: "Biopago",
  transfer: "Transferencia",
  transferencia: "Transferencia",
  cheque: "Cheque",
  other: "Otro",
};

export function paymentLabel(method?: string, currency?: string): string {
  if (method === "dollars" || currency === "USD") return "Efectivo USD";
  return PAYMENT_LABELS[(method || "").toLowerCase()] || "Otro";
}

interface FallbackOrderShape {
  medications: Array<{
    quantity: number;
    price: number;
    name?: string;
    description?: string;
    barCode?: string;
  }>;
  rate?: number;
  client?: { name?: string; documento?: string };
  payments?: unknown;
  facturacion?: {
    numero_control?: string | null;
    numeroControl?: string | null;
    fecha?: string;
    resp?: { numerocontrol?: string; fecha?: string } | null;
  } | null;
  numeroControlInterno?: string;
  date?: string;
  id?: string;
}

/** Pagos del comprobante: todo en Bs (divisa x tasa). */
function buildPayments(order: FallbackOrderShape, rate: number, fallbackTotal: number): TicketMoneyLine[] {
  const raw = order.payments;
  const pays = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  if (pays.length === 0) return [{ label: "Efectivo Bs", amount: fallbackTotal }];
  return pays.map((p) => {
    const method = String(p.method ?? "");
    const currency = String(p.currency ?? "");
    const isUsd = method === "dollars" || currency === "USD";
    const amountBs = toBs2((Number(p.amount) || 0) * (isUsd ? rate : 1));
    return { label: paymentLabel(method, currency), amount: amountBs };
  });
}

function fmtDate(input?: string | Date | null): string {
  const d = input ? new Date(input) : new Date();
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface SaleTicketInputs {
  header: TicketHeader;
  order: FallbackOrderShape;
  controlNumber: string;
  date: string;
}

/**
 * Comprobante de venta "No Fiscal" (mismo formato que la impresion original).
 * Funcion pura: reutilizada tanto en el fallback de venta como en la reimpresion.
 */
export function buildSaleTicketForOrder(inputs: SaleTicketInputs): NoFiscalTicket {
  const order = inputs.order;
  const rate = order.rate || 1;
  const items = (order.medications || []).map((m) => {
    const base = m.name || m.description || "";
    return {
      qty: m.quantity,
      description: m.barCode ? `[${m.barCode}] ${base}` : base,
      amount: toBs2(m.quantity * toBs2(m.price * rate)),
    };
  });
  const total = toBs2(items.reduce((sum, it) => sum + it.amount, 0));
  return {
    kind: "sale",
    header: inputs.header,
    title: "COMPROBANTE NO FISCAL",
    controlNumber: inputs.controlNumber,
    date: inputs.date,
    customerName: order.client?.name || "Cliente General",
    customerDoc: order.client?.documento || "V-00000000",
    items,
    totals: [],
    total,
    payments: buildPayments(order, rate, total),
    legend: NO_FISCAL,
  };
}

/** Reimpresion: reusa numero de control, fecha y montos del comprobante original. */
export function buildSaleReprintTicket(
  header: TicketHeader,
  order: FallbackOrderShape,
): NoFiscalTicket {
  const fac = order.facturacion;
  const controlNumber = String(
    fac?.numero_control ||
      fac?.numeroControl ||
      fac?.resp?.numerocontrol ||
      order.numeroControlInterno ||
      order.id ||
      "",
  );
  const dateSource =
    fac?.resp?.fecha || fac?.fecha || order.date || new Date().toISOString();
  return buildSaleTicketForOrder({
    header,
    order,
    controlNumber,
    date: fmtDate(dateSource),
  });
}

export interface OrderFallbackInputs<TResult extends { ordenId: string }> {
  header: TicketHeader;
  order: Record<string, unknown>;
  initialResult: TResult | null;
  transportFailed: boolean;
  saleType: "local" | "digital";
  sessionId: string;
  submitOrder: (
    order: Record<string, unknown>,
    saleType: "local" | "digital",
    sessionId: string,
  ) => Promise<TResult>;
  print: PrintFn;
}

export interface OrderFallbackOutcome {
  facturacion: unknown;
  ordenId: string;
  fiscalFallback: true;
  printError?: string;
}

export async function runOrderFallback<TResult extends { ordenId: string }>(
  inputs: OrderFallbackInputs<TResult>,
): Promise<OrderFallbackOutcome> {
  const order = inputs.order as unknown as FallbackOrderShape;
  const invoice = buildFallbackInvoice(order);
  const fallbackOrder = applyFallbackInvoiceToOrder(inputs.order, invoice);

  const printOutcome = await inputs.print(
    buildSaleTicketForOrder({
      header: inputs.header,
      order,
      controlNumber: invoice.numeroControl,
      date: fmtDate(invoice.fecha),
    }),
  );

  // Solo se reintenta persistir cuando la llamada original fallo por
  // transporte; un success=false del backend ya dejo su propio ordenId.
  let ordenId = inputs.initialResult?.ordenId ?? "";
  if (inputs.transportFailed) {
    try {
      const retry = await inputs.submitOrder(
        fallbackOrder,
        inputs.saleType,
        inputs.sessionId,
      );
      ordenId = retry.ordenId;
    } catch (error) {
      console.error(
        "❌ [registerSale] Reintento de persistencia No Fiscal fallo:",
        error instanceof Error ? error.message : "Error de transporte",
      );
    }
  }

  return {
    facturacion: fallbackOrder.facturacion,
    ordenId,
    fiscalFallback: true,
    printError: printOutcome.printed
      ? undefined
      : printOutcome.error || "No se pudo imprimir el comprobante en la POS80",
  };
}

export interface ZFallbackResultLike<TReport> {
  success: boolean;
  report?: TReport | null;
}

export interface ZFallbackInputs<
  TReport extends { fiscalDate?: string | null; zNumber?: number | null },
> {
  header: TicketHeader;
  pharmacyId: string;
  sessionInvoices: FallbackZInvoice[];
  /** Desglose NETO por metodo de pago, YA en Bs. */
  paymentBreakdown?: TicketMoneyLine[];
  /** Devoluciones / notas de credito, YA en Bs. */
  deviations?: TicketMoneyLine[];
  /** Lineas de cuadre; deben dar 0. */
  reconciliation?: TicketMoneyLine[];
  /** Total NETO (ventas − devoluciones). Si falta, se usa el bruto del fallback. */
  netTotal?: number;
  rate?: number;
  initialResult: ZFallbackResultLike<TReport>;
  createZReport: (
    pharmacyId: string,
    payload: CreateZReportDto,
  ) => Promise<ZFallbackResultLike<TReport>>;
  print: PrintFn;
  record: (marker: FallbackZMarker) => void;
}

export interface ZFallbackOutcome<TReport> {
  fallback: FallbackZReport;
  report: TReport | null;
}

/** Totales del reporte (Z y X comparten el mismo desglose). */
function reportTotals(f: FallbackZReport): TicketMoneyLine[] {
  return [
    { label: "Ventas base", amount: f.taxed_sales },
    { label: "IVA", amount: f.iva_monto },
    { label: "Ventas exentas", amount: f.exempt_sales },
    { label: "IGTF", amount: f.igtf_monto },
  ];
}

export async function runZReportFallback<
  TReport extends { fiscalDate?: string | null; zNumber?: number | null },
>(inputs: ZFallbackInputs<TReport>): Promise<ZFallbackOutcome<TReport>> {
  const fallback = buildFallbackZReport({
    sessionInvoices: inputs.sessionInvoices,
    pharmacyId: inputs.pharmacyId,
  });

  const fields: { label: string; value: string }[] = [
    { label: "Nro Z", value: `#${fallback.z_number}` },
    { label: "Serial", value: fallback.fiscal_serial },
    {
      label: "Documentos",
      value: fallback.invoices ? `${fallback.invoices.doc_from} a ${fallback.invoices.doc_to}` : "-",
    },
    { label: "Contribuyentes", value: String(fallback.taxpayers) },
    { label: "No contrib.", value: String(fallback.non_taxpayers) },
  ];
  if (inputs.rate && inputs.rate > 0) {
    fields.push({ label: "Tasa USD", value: inputs.rate.toFixed(4) });
  }

  await inputs.print({
    kind: "report",
    header: inputs.header,
    title: "REPORTE Z NO FISCAL",
    date: fmtDate(new Date()),
    fields,
    totals: reportTotals(fallback),
    deviations: inputs.deviations ?? [],
    paymentBreakdown: inputs.paymentBreakdown ?? [],
    total: inputs.netTotal ?? fallback.total_sales,
    reconciliation: inputs.reconciliation ?? [],
    legend: NO_FISCAL,
  });

  // Reintento unico de persistencia con los identificadores sintetizados.
  // ponytail: se reintenta siempre en el fallback; un 5xx con escritura
  // parcial podria duplicar el Z. Acotar a statusCode===0 si aparece.
  let report: TReport | null = inputs.initialResult.report ?? null;
  try {
    const retry = await inputs.createZReport(inputs.pharmacyId, {
      z_number: fallback.z_number,
      fiscal_serial: fallback.fiscal_serial,
      fiscal_date: fallback.fiscal_date,
      invoices: fallback.invoices,
    });
    if (retry.success && retry.report) report = retry.report;
  } catch {
    // el servicio normaliza los errores HTTP; esto cubre fallos de transporte
  }

  inputs.record({
    pharmacyId: inputs.pharmacyId,
    fiscalDate: report?.fiscalDate || fallback.fiscal_date,
    zNumber: report?.zNumber || fallback.z_number,
  });

  return { fallback, report };
}

// --- Reporte X (No Fiscal) ---

export interface XReportFallbackInputs {
  header: TicketHeader;
  pharmacyId: string;
  sessionInvoices: FallbackZInvoice[];
  /** Desglose NETO por metodo de pago, YA en Bs. */
  paymentBreakdown?: TicketMoneyLine[];
  /** Devoluciones / notas de credito, YA en Bs. */
  deviations?: TicketMoneyLine[];
  /** Lineas de cuadre; deben dar 0. */
  reconciliation?: TicketMoneyLine[];
  /** Total NETO (ventas − devoluciones). Si falta, se usa el bruto. */
  netTotal?: number;
  rate?: number;
  print: PrintFn;
}

export interface XReportFallbackOutcome {
  printed: boolean;
  error?: string;
}

/**
 * Reporte X "No Fiscal" en la POS80: corte PARCIAL del turno. Mismo cuadre que
 * el Z, pero no cierra la sesion, no lleva Nro Z y no persiste nada.
 */
export async function runXReportFallback(
  inputs: XReportFallbackInputs,
): Promise<XReportFallbackOutcome> {
  const fallback = buildFallbackZReport({
    sessionInvoices: inputs.sessionInvoices,
    pharmacyId: inputs.pharmacyId,
  });

  const fields: { label: string; value: string }[] = [
    {
      label: "Documentos",
      value: fallback.invoices ? `${fallback.invoices.doc_from} a ${fallback.invoices.doc_to}` : "-",
    },
    { label: "Facturas", value: String(fallback.invoices?.count ?? 0) },
    { label: "Contribuyentes", value: String(fallback.taxpayers) },
    { label: "No contrib.", value: String(fallback.non_taxpayers) },
  ];
  if (inputs.rate && inputs.rate > 0) {
    fields.push({ label: "Tasa USD", value: inputs.rate.toFixed(4) });
  }

  const outcome = await inputs.print({
    kind: "report",
    header: inputs.header,
    title: "REPORTE X NO FISCAL",
    date: fmtDate(new Date()),
    fields,
    totals: reportTotals(fallback),
    deviations: inputs.deviations ?? [],
    paymentBreakdown: inputs.paymentBreakdown ?? [],
    total: inputs.netTotal ?? fallback.total_sales,
    reconciliation: inputs.reconciliation ?? [],
    legend: NO_FISCAL,
  });

  return { printed: outcome.printed, error: outcome.error };
}

export interface NoteFallbackInputs<TPayload extends object> {
  header: TicketHeader;
  payload: TPayload;
  createNote: (payload: TPayload) => Promise<unknown>;
  print: PrintFn;
  affectedDocument: string;
  total: number;
  customerName?: string;
  customerDoc?: string;
  reason?: string;
}

export async function runNoteFallback<TPayload extends object>(
  inputs: NoteFallbackInputs<TPayload>,
): Promise<FallbackNote> {
  const note = buildFallbackNote();

  await inputs.print({
    kind: "credit-note",
    header: inputs.header,
    title: "NOTA DE CREDITO NO FISCAL",
    controlNumber: note.numero_control,
    trackingId: note.tracking_id,
    date: fmtDate(note.fecha),
    customerName: inputs.customerName || "Cliente General",
    customerDoc: inputs.customerDoc || "V-00000000",
    affectedDoc: inputs.affectedDocument,
    reason: inputs.reason,
    total: inputs.total,
    legend: NO_FISCAL,
  });

  // Reintento unico de persistencia con los identificadores sintetizados.
  // ponytail: createNotaCredito normaliza los errores HTTP y createCreditNoteTFHKA
  // lanza en cualquier error; no se distingue transporte de 4xx, se reintenta siempre.
  try {
    await inputs.createNote({
      ...inputs.payload,
      tracking_id: note.tracking_id,
      numero_control_interno: note.numero_control,
    } as TPayload);
  } catch {
    // el reintento fallo: la nota queda impresa como "No Fiscal"
  }

  return note;
}
