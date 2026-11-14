// Orquestacion del fallback de impresion (detectar -> sintetizar -> imprimir ->
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
import { toBs2, fiscalLineTotalBs } from "./money.ts";
import type { NoFiscalTicket, NoFiscalPrintResult } from "./pos80-print.ts";
import type { TicketHeader, TicketMoneyLine } from "./pos80-ticket.ts";
import type { CreateZReportDto } from "@/modules/cash-register/types/fiscal-z-report.types";

export type PrintFn = (ticket: NoFiscalTicket) => Promise<NoFiscalPrintResult>;

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
  cashea: "Cashea",
  divisa_electronica: "Divisa Electrónica",
  divisaelectronica: "Divisa Electrónica",
  transfer: "Transferencia",
  transferencia: "Transferencia",
  cheque: "Cheque",
  other: "Otro",
};

export function paymentLabel(method?: string, currency?: string): string {
  const key = (method || "").toLowerCase();
  if (key === "divisa_electronica" || key === "divisaelectronica") return "Divisa Electrónica";
  if (method === "dollars" || currency === "USD") return "Efectivo USD";
  return PAYMENT_LABELS[key] || "Otro";
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
  numeroControlInterno?: string | null;
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
    const isUsd = method === "dollars" || method === "divisaElectronica" || currency === "USD";
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
 * Comprobante de venta (mismo formato que la impresion original, sin marcas
 * fiscales: es el papel que se entrega al cliente).
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
      amount: fiscalLineTotalBs(m.price, m.quantity, rate),
    };
  });
  const total = toBs2(items.reduce((sum, it) => sum + it.amount, 0));
  return {
    kind: "sale",
    header: inputs.header,
    // Sin titulo: headerBlock omite la linea y el ticket de venta no menciona
    // el caracter fiscal del comprobante en ningun lugar.
    title: "",
    controlNumber: inputs.controlNumber,
    date: inputs.date,
    customerName: order.client?.name || "Cliente General",
    customerDoc: order.client?.documento || "V-00000000",
    items,
    totals: [],
    total,
    payments: buildPayments(order, rate, total),
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
        "❌ [registerSale] Reintento de persistencia de la venta fallo:",
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
  message?: string | null;
  statusCode?: number | null;
}

/** Identidad con la que el fallback intento registrar el Z en el backend. */
export interface ZFallbackZIdentity {
  pharmacyId: string;
  fiscalDate: string;
  zNumber: number;
  fiscalSerial: string;
}

/** Datos para imprimir el Z en la POS80 (sin maquina fiscal). */
export interface ZPrintInputs {
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
  print: PrintFn;
}

export interface ZPrintOutcome {
  fallback: FallbackZReport;
  printed: boolean;
  error?: string;
}

export interface ZFallbackInputs<
  TReport extends { fiscalDate?: string | null; zNumber?: number | null },
> extends ZPrintInputs {
  initialResult: ZFallbackResultLike<TReport>;
  createZReport: (
    pharmacyId: string,
    payload: CreateZReportDto,
  ) => Promise<ZFallbackResultLike<TReport>>;
  /**
   * Consulta el backend para saber si el Z realmente quedo registrado. Se usa
   * solo cuando la escritura fue ambigua (rechazo sin datos o error de
   * transporte): la respuesta puede perderse despues de escribirse.
   */
  findPersistedZ?: (identity: ZFallbackZIdentity) => Promise<TReport | null>;
  record: (marker: FallbackZMarker) => void;
}

export interface ZFallbackPersistOutcome<TReport> {
  report: TReport | null;
  /** false = el ticket se imprimio pero el Z NO quedo registrado. */
  persisted: boolean;
  /** true = el fallo fue ambiguo y el backend confirmo que el Z existe. */
  reconciled?: boolean;
  persistError?: string;
}

export interface ZFallbackOutcome<TReport> extends ZFallbackPersistOutcome<TReport> {
  fallback: FallbackZReport;
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

/** Ticket del reporte Z para la POS80 (mismo papel para el fallback y para el print solo). */
function buildZFallbackTicket(
  inputs: ZPrintInputs,
  fallback: FallbackZReport,
): NoFiscalTicket {
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

  return {
    kind: "report",
    header: inputs.header,
    title: "REPORTE Z",
    date: fmtDate(new Date()),
    fields,
    totals: reportTotals(fallback),
    deviations: inputs.deviations ?? [],
    paymentBreakdown: inputs.paymentBreakdown ?? [],
    total: inputs.netTotal ?? fallback.total_sales,
    reconciliation: inputs.reconciliation ?? [],
  };
}

function buildZFallbackReport(inputs: ZPrintInputs): FallbackZReport {
  return buildFallbackZReport({
    sessionInvoices: inputs.sessionInvoices,
    pharmacyId: inputs.pharmacyId,
  });
}

/**
 * SOLO imprime el reporte Z en la POS80: no registra nada.
 *
 * Imprimir el Z y cargar las ventas en el libro son dos operaciones separadas:
 * este helper es la impresion cuando la maquina fiscal no puede sacar el papel.
 * La identidad que queda en el comprobante se devuelve para que el registro
 * posterior la reuse.
 */
export async function printZReportFallback(inputs: ZPrintInputs): Promise<ZPrintOutcome> {
  const fallback = buildZFallbackReport(inputs);
  const outcome = await inputs.print(buildZFallbackTicket(inputs, fallback));
  return {
    fallback,
    printed: outcome.printed,
    error: outcome.printed
      ? undefined
      : outcome.error?.trim() || "No se pudo imprimir el reporte Z en la POS80",
  };
}

/**
 * Camino historico "imprimir + registrar de una": lo conserva solo la suite de
 * tests. La UI ya no lo usa porque el cierre son dos operaciones separadas
 * (imprimir el Z y cargar el libro de ventas, cada una en su boton).
 */
export async function runZReportFallback<
  TReport extends { fiscalDate?: string | null; zNumber?: number | null },
>(inputs: ZFallbackInputs<TReport>): Promise<ZFallbackOutcome<TReport>> {
  const { fallback } = await printZReportFallback(inputs);

  // Primer intento: si ya devolvio el Z, esta registrado. Reintentar con los
  // identificadores sinteticos sobreescribiria un Z real (o chocaria por
  // solapamiento), asi que no se toca.
  if (inputs.initialResult.report) {
    const report = inputs.initialResult.report;
    inputs.record({
      pharmacyId: inputs.pharmacyId,
      fiscalDate: report.fiscalDate || fallback.fiscal_date,
      zNumber: report.zNumber || fallback.z_number,
    });
    return { fallback, report, persisted: true };
  }

  const persist = await persistFallbackZ({
    pharmacyId: inputs.pharmacyId,
    fallback,
    createZReport: inputs.createZReport,
    findPersistedZ: inputs.findPersistedZ,
  });

  // El marcador local hace que el historial marque el Z como salido por la POS80.
  // Marcarlo sin que exista en el backend es afirmar algo falso: por eso solo
  // se registra cuando la persistencia quedo confirmada.
  if (persist.persisted && persist.report) {
    inputs.record({
      pharmacyId: inputs.pharmacyId,
      fiscalDate: persist.report.fiscalDate || fallback.fiscal_date,
      zNumber: persist.report.zNumber || fallback.z_number,
    });
  }

  return { fallback, ...persist };
}

/**
 * Registra el Z sintetizado del fallback, sin imprimir nada.
 *
 * Es la unica ruta de persistencia: la usa el flujo normal y el reintento manual
 * de la pantalla de error, para que un Z ya impreso nunca quede sin registrar.
 */
export async function persistFallbackZ<
  TReport extends { fiscalDate?: string | null; zNumber?: number | null },
>(inputs: {
  pharmacyId: string;
  fallback: FallbackZReport;
  createZReport: (
    pharmacyId: string,
    payload: CreateZReportDto,
  ) => Promise<ZFallbackResultLike<TReport>>;
  findPersistedZ?: (identity: ZFallbackZIdentity) => Promise<TReport | null>;
}): Promise<ZFallbackPersistOutcome<TReport>> {
  const { fallback, pharmacyId } = inputs;
  let failure = "";

  try {
    const retry = await inputs.createZReport(pharmacyId, {
      z_number: fallback.z_number,
      fiscal_serial: fallback.fiscal_serial,
      fiscal_date: fallback.fiscal_date,
      // Sin `invoices`: el backend deriva el bloque documental y el rango
      // `(cierre anterior, ahora]` de las facturas reales. Enviarlo lo
      // sobreescribiria con los datos de sesion del POS.
    });
    if (retry.success && retry.report) {
      return { report: retry.report, persisted: true };
    }
    failure =
      retry.message?.trim() ||
      `El backend no devolvio el reporte Z (HTTP ${retry.statusCode ?? 0}).`;
  } catch (error) {
    // El servicio normaliza los errores HTTP; esto cubre fallos de transporte
    // (incluida una escritura que se completo y perdio la respuesta).
    failure =
      error instanceof Error && error.message
        ? error.message
        : "Error de transporte al registrar el reporte Z.";
  }

  // Antes de declarar el fallo, preguntar al backend si el Z existe: una
  // escritura puede completarse y perderse la respuesta (timeout de red). Sin
  // esta reconciliacion el POS pediria reintentar un Z que ya esta guardado.
  if (inputs.findPersistedZ) {
    try {
      const existing = await inputs.findPersistedZ({
        pharmacyId,
        fiscalDate: fallback.fiscal_date,
        zNumber: fallback.z_number,
        fiscalSerial: fallback.fiscal_serial,
      });
      if (existing) {
        return { report: existing, persisted: true, reconciled: true };
      }
    } catch {
      // La reconciliacion fallida no puede tapar el motivo original.
    }
  }

  return { report: null, persisted: false, persistError: failure };
}

/**
 * Payload del registro del Z en el libro de ventas.
 *
 * Solo viaja la identidad que capturo la impresion (Nº Z y serial de la maquina
 * fiscal). Sin print capturado el backend deriva todo desde las facturas del
 * dia, igual que antes. Nunca se manda `invoices`: sobreescribiria el rango real.
 */
export function buildZRegisterPayload(
  captured?: { zNumber?: number | null; fiscalSerial?: string | null } | null,
): CreateZReportDto {
  const payload: CreateZReportDto = {};
  const zNumber = Number(captured?.zNumber);
  if (Number.isInteger(zNumber) && zNumber > 0) payload.z_number = zNumber;
  const fiscalSerial = (captured?.fiscalSerial ?? "").trim();
  if (fiscalSerial) payload.fiscal_serial = fiscalSerial;
  return payload;
}

/** Mensaje de error del registro, con el mismo mapeo por codigo de siempre. */
export function zReportErrorMessage(
  result: { message?: string | null; statusCode?: number | null },
  fallbackMessage = "No se pudo registrar el reporte Z.",
): string {
  const message = result.message?.trim() || fallbackMessage;
  switch (result.statusCode) {
    case 400:
      return `Validación (400): ${message}`;
    case 401:
      return `No autorizado (401): ${message}`;
    case 403:
      return `Acceso denegado (403): ${message}`;
    case 404:
      return `Farmacia no encontrada (404): ${message}`;
    case 409:
      return `Conflicto (409): ${message}`;
    default:
      return message;
  }
}

// --- Reporte X ---

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
 * Reporte X en la POS80: corte PARCIAL del turno. Mismo cuadre que el Z, pero
 * no cierra la sesion, no lleva Nro Z y no persiste nada.
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
    title: "REPORTE X",
    date: fmtDate(new Date()),
    fields,
    totals: reportTotals(fallback),
    deviations: inputs.deviations ?? [],
    paymentBreakdown: inputs.paymentBreakdown ?? [],
    total: inputs.netTotal ?? fallback.total_sales,
    reconciliation: inputs.reconciliation ?? [],
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
    title: "NOTA DE CREDITO",
    controlNumber: note.numero_control,
    trackingId: note.tracking_id,
    date: fmtDate(note.fecha),
    customerName: inputs.customerName || "Cliente General",
    customerDoc: inputs.customerDoc || "V-00000000",
    affectedDoc: inputs.affectedDocument,
    reason: inputs.reason,
    total: inputs.total,
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
    // el reintento fallo: la nota queda impresa y la persistencia pendiente
  }

  return note;
}
