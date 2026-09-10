// Orquestacion del fallback "No Fiscal" (detectar -> sintetizar -> imprimir ->
// reintentar persistir), con las llamadas externas inyectadas para poder
// cubrirla sin React/DOM/red. Los montos NUNCA se calculan aqui: vienen de
// money.ts a traves de fiscal-fallback.ts. Cada call site decide cuando hay
// fallo y solo llama a estos helpers en ese caso.

import {
  buildFallbackInvoice,
  applyFallbackInvoiceToOrder,
  buildFallbackZReport,
  buildFallbackNote,
  type FallbackNote,
  type FallbackZMarker,
  type FallbackZReport,
} from "./fiscal-fallback.ts";
import type { NoFiscalTicketDoc, NoFiscalPrintResult } from "./pos58-print.ts";
import type { CreateZReportDto } from "@/modules/cash-register/types/fiscal-z-report.types";

export type PrintFn = (doc: NoFiscalTicketDoc) => Promise<NoFiscalPrintResult>;

export interface OrderFallbackInputs<TResult extends { ordenId: string }> {
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
}

export async function runOrderFallback<TResult extends { ordenId: string }>(
  inputs: OrderFallbackInputs<TResult>,
): Promise<OrderFallbackOutcome> {
  const invoice = buildFallbackInvoice(
    inputs.order as {
      medications: Array<{ quantity: number; price: number }>;
      rate?: number;
    },
  );
  const fallbackOrder = applyFallbackInvoiceToOrder(inputs.order, invoice);

  await inputs.print({
    title: "Comprobante No Fiscal",
    lines: [
      { label: "Control", value: invoice.numeroControl },
      { label: "Fecha", value: invoice.fecha },
      { label: "Total", value: `Bs ${invoice.total.toFixed(2)}` },
    ],
  });

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
  };
}

export interface ZFallbackResultLike<TReport> {
  success: boolean;
  report?: TReport | null;
}

export interface ZFallbackInputs<
  TReport extends { fiscalDate?: string | null; zNumber?: number | null },
> {
  pharmacyId: string;
  sessionInvoices: Array<{ controlNumber?: string; totalVes?: number }>;
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

export async function runZReportFallback<
  TReport extends { fiscalDate?: string | null; zNumber?: number | null },
>(inputs: ZFallbackInputs<TReport>): Promise<ZFallbackOutcome<TReport>> {
  const fallback = buildFallbackZReport({
    sessionInvoices: inputs.sessionInvoices,
    pharmacyId: inputs.pharmacyId,
  });

  await inputs.print({
    title: "Reporte Z No Fiscal",
    lines: [
      { label: "Z", value: `#${fallback.z_number}` },
      { label: "Serial", value: fallback.fiscal_serial },
      { label: "Fecha", value: fallback.fiscal_date },
      { label: "Ventas", value: `Bs ${fallback.total_sales.toFixed(2)}` },
    ],
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

export interface NoteFallbackInputs<TPayload extends object> {
  payload: TPayload;
  createNote: (payload: TPayload) => Promise<unknown>;
  print: PrintFn;
  affectedDocument: string;
  total: number;
}

export async function runNoteFallback<TPayload extends object>(
  inputs: NoteFallbackInputs<TPayload>,
): Promise<FallbackNote> {
  const note = buildFallbackNote();

  await inputs.print({
    title: "Nota de Crédito No Fiscal",
    lines: [
      { label: "Control", value: note.numero_control },
      { label: "Tracking", value: note.tracking_id },
      { label: "Afecta", value: inputs.affectedDocument },
      { label: "Total", value: `Bs ${inputs.total.toFixed(2)}` },
    ],
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
