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

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const shaped = error as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  } | null;
  return (
    shaped?.response?.data?.message ||
    shaped?.response?.data?.error ||
    shaped?.message ||
    fallback
  );
}
import type { NoFiscalTicket, NoFiscalPrintResult } from "./pos80-print.ts";
import type { TicketHeader, TicketMoneyLine } from "./pos80-ticket.ts";
import type { CreateZReportDto } from "@/modules/cash-register/types/fiscal-z-report.types";
import type { SaleChannel } from "./channel-detect.ts";

export type PrintFn = (ticket: NoFiscalTicket) => Promise<NoFiscalPrintResult>;

/**
 * Lo unico que estos helpers necesitan de la decision de canal
 * (`ChannelDecision` de `channel-detect.ts` cumple esta forma tal cual).
 */
export interface DocumentChannelState {
  channel: SaleChannel;
  /** Motivo del canal (`ChannelDecision.reason`); viaja en el error (Spec S6). */
  reason?: string;
  /**
   * `ChannelDecision.ready`: con true el canal puede emitir, asi que el motivo
   * es informativo y no se repite en el error.
   */
  ready?: boolean;
}

/**
 * Regla R7: un documento derivado (nota de credito, X, Z) solo se imprime por
 * la POS80 cuando el canal DETECTADO de esta terminal es POS80. Con el servicio
 * fiscal vivo el canal es fiscal y un fallo de la maquina es un error con
 * motivo, nunca un comprobante por el otro canal.
 *
 * Devuelve el motivo del bloqueo, o null cuando la POS80 es el canal correcto.
 * Sin canal declarado se mantiene el comportamiento historico del helper
 * (imprimir por la POS80); los call sites de la UI siempre pasan el canal que
 * resolvio `resolveTerminalChannel()`.
 */
export function documentChannelBlockReason(
  documentLabel: string,
  channel?: DocumentChannelState,
): string | null {
  if (channel === undefined || channel.channel === "pos80") return null;
  const detail = channel.ready === true ? undefined : channel.reason?.trim();
  return `El servicio fiscal está activo en esta terminal: ${documentLabel} tiene que salir por la máquina fiscal${
    detail ? ` (${detail})` : ""
  }. No se imprime por la POS80.`;
}

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
  /** El comprobante salio en papel. Sin esto no hay venta (Spec S4). */
  printed: boolean;
  /**
   * La orden quedo registrada en el backend. Impreso NO implica registrado: si
   * el envio falla despues de sacar el papel, la venta no existe para el
   * sistema aunque el cliente se lleve el ticket (Regla R6, direccion inversa).
   */
  persisted: boolean;
  printError?: string;
  persistError?: string;
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

  // Sin papel no hay venta: la orden NO se envia. Antes se enviaba igual y el
  // resultado del print solo se devolvia como dato informativo, asi que un
  // fallo de la POS80 dejaba la venta en el backend y la pantalla decia
  // "Venta procesada" (ver Spec S4). El carrito queda intacto para reintentar.
  if (!printOutcome.printed) {
    return {
      facturacion: null,
      ordenId: "",
      fiscalFallback: true,
      printed: false,
      persisted: false,
      printError:
        printOutcome.error || "No se pudo imprimir el comprobante en la POS80",
    };
  }

  // Solo se reintenta persistir cuando la llamada original fallo por
  // transporte; un success=false del backend ya dejo su propio ordenId.
  let ordenId = inputs.initialResult?.ordenId ?? "";
  let persisted = ordenId !== "";
  let persistError: string | undefined;
  if (inputs.transportFailed) {
    try {
      const retry = await inputs.submitOrder(
        fallbackOrder,
        inputs.saleType,
        inputs.sessionId,
      );
      ordenId = retry.ordenId;
      persisted = true;
    } catch (error) {
      // El papel ya salio y la orden NO se registro. Antes el error se tragaba
      // y el call site anunciaba "Venta registrada": una venta perdida en
      // silencio con el ticket en la mano del cliente (Regla R6).
      persistError = messageOf(error, "error desconocido al registrar");
      console.error(
        "❌ [registerSale] Reintento de persistencia de la venta fallo:",
        persistError,
      );
    }
  } else if (ordenId === "") {
    persisted = false;
    persistError = "el backend no devolvió un identificador de orden";
  }

  return {
    facturacion: fallbackOrder.facturacion,
    ordenId,
    fiscalFallback: true,
    printed: true,
    persisted,
    ...(persistError ? { persistError } : {}),
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
  /** Canal DETECTADO de la terminal (Regla R7). */
  channel?: DocumentChannelState;
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

  // Un cierre no cruza de canal: con el servicio fiscal vivo, el Z sale por la
  // maquina fiscal. Si la maquina falla se informa el motivo y NO se inventa un
  // Z con la identidad sintetica de la POS80 (Reglas R7 y R6).
  const blocked = documentChannelBlockReason("el reporte Z", inputs.channel);
  if (blocked) return { fallback, printed: false, error: blocked };

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
  /** Canal DETECTADO de la terminal (Regla R7). */
  channel?: DocumentChannelState;
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
  // Misma regla que el Z: el corte sale por el canal detectado, sin cruzar.
  const blocked = documentChannelBlockReason("el reporte X", inputs.channel);
  if (blocked) return { printed: false, error: blocked };

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
  /** Canal DETECTADO de la terminal (Regla R7). */
  channel?: DocumentChannelState;
}

/**
 * Resultado del fallback de nota de credito. Lleva los datos del comprobante
 * sintetizado (`FallbackNote`, que ya consumian los call sites) mas el mismo
 * par `printed`/`persisted` que devuelve `runOrderFallback`: impreso NO implica
 * registrado.
 */
export interface NoteFallbackOutcome extends FallbackNote {
  /** El comprobante salio en papel por la POS80. */
  printed: boolean;
  /** La nota quedo persistida (reintento incluido). */
  persisted: boolean;
  printError?: string;
  persistError?: string;
  /** Motivo por el que el canal detectado NO permite imprimir por la POS80. */
  blockedReason?: string;
}

/** Lo que el dialogo le muestra al operador despues del fallback. */
export interface NoteFallbackDisplay {
  /** true SOLO si el papel salio y la nota quedo registrada (Regla R6). */
  ok: boolean;
  message: string;
  /**
   * Flag EJECUTABLE, no una frase: el documento ya existe por un lado (papel en
   * la mano del cliente o nota en el backend) aunque falte el otro. Volver al
   * formulario y emitir de nuevo genera un `numero_control` y un `tracking_id`
   * nuevos, o sea una SEGUNDA nota de credito y una doble devolucion. Con esto
   * en true el dialogo no puede ofrecer "Emitir NC".
   */
  mustNotReemit: boolean;
}

/**
 * Decide QUE SE LE DICE al operador despues del fallback de nota de credito.
 *
 * Papel y registro son dos hechos distintos (Regla R6): el dialogo solo puede
 * anunciar la nota como emitida cuando el comprobante salio Y la nota quedo
 * registrada. Antes se anunciaba siempre con el control sintetizado, aunque no
 * hubiera papel ni registro.
 */
export function describeNoteFallbackOutcome(
  outcome: NoteFallbackOutcome,
): NoteFallbackDisplay {
  // El flag sale de los DOS HECHOS, nunca del texto del mensaje. `printed` y
  // `persisted` discrepan exactamente en los dos casos en los que el documento
  // ya existe por un lado y falta el otro: o el papel salio y el backend no la
  // registro, o el backend la registro y el papel no salio. Reintentar duplica.
  // Si los dos son true la nota ya se emitio (el dialogo muestra el resultado);
  // si los dos son false no hay nada que duplicar y reintentar es legitimo
  // (POS80 muda y backend que no registro, o canal fiscal bloqueado).
  const mustNotReemit = outcome.printed !== outcome.persisted;

  // Canal fiscal: la nota no salio por ningun canal propio. El motivo concreto
  // (servicio activo, maquina muda) es lo unico que hay para mostrar.
  if (outcome.blockedReason) {
    return { ok: false, message: outcome.blockedReason, mustNotReemit };
  }

  if (!outcome.printed) {
    const motivo = outcome.printError || "el comprobante no salió por la POS80";
    return {
      ok: false,
      mustNotReemit,
      message: outcome.persisted
        ? `La nota de crédito quedó registrada, pero el comprobante no salió por la POS80: ${motivo}. No vuelvas a emitir la nota para no duplicarla; pedí el comprobante desde soporte.`
        : `No se pudo imprimir la nota de crédito: ${motivo}. La nota no quedó emitida.`,
    };
  }

  if (!outcome.persisted) {
    return {
      ok: false,
      mustNotReemit,
      message: `El comprobante salió por la POS80 pero la nota no quedó registrada: ${
        outcome.persistError ?? "el backend no confirmó el registro"
      }. No vuelvas a emitir la nota: verificá el listado y regularizá el registro desde soporte.`,
    };
  }

  return {
    ok: true,
    mustNotReemit,
    message: `Nota de Crédito emitida: ${outcome.numero_control}`,
  };
}

export async function runNoteFallback<TPayload extends object>(
  inputs: NoteFallbackInputs<TPayload>,
): Promise<NoteFallbackOutcome> {
  const note = buildFallbackNote();

  // Con el servicio fiscal vivo la nota tiene que salir por la maquina fiscal:
  // el call site muestra ese error y este helper NO imprime por la POS80 ni
  // persiste un comprobante que no salio por ningun canal (Regla R7).
  const blocked = documentChannelBlockReason("la nota de crédito", inputs.channel);
  if (blocked) return { ...note, printed: false, persisted: false, blockedReason: blocked };

  const printOutcome = await inputs.print({
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
  const printed = printOutcome.printed === true;

  // Reintento unico de persistencia con los identificadores sintetizados.
  // ponytail: createNotaCredito normaliza los errores HTTP y createCreditNoteTFHKA
  // lanza en cualquier error; no se distingue transporte de 4xx, se reintenta siempre.
  let persisted = false;
  let persistError: string | undefined;
  try {
    await inputs.createNote({
      ...inputs.payload,
      tracking_id: note.tracking_id,
      numero_control_interno: note.numero_control,
    } as TPayload);
    persisted = true;
  } catch (error) {
    // el reintento fallo: la nota queda impresa y la persistencia pendiente
    persistError = messageOf(error, "no se pudo registrar la nota de crédito");
  }

  return {
    ...note,
    printed,
    persisted,
    ...(printed
      ? {}
      : {
          printError:
            printOutcome.error?.trim() ||
            "No se pudo imprimir la nota de crédito en la POS80",
        }),
    ...(persistError ? { persistError } : {}),
  };
}
