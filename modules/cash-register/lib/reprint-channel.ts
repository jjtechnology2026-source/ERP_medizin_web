// Reimpresion de una venta por la POS80: la ultima superficie que todavia
// cruzaba de canal (`odd/tasks/canal-comprobante-por-caja.md`, T11, Regla R7).
//
// Hay dos casos legitimos DISTINTOS y confundirlos rompe uno de los dos:
//
//   venta NO fiscal (la emitio esta misma POS80) -> reimprimirla por la POS80 es
//     correcto en CUALQUIER canal: el papel que se reusa ya era no fiscal.
//   venta FISCAL (tiene el COO real de la maquina) -> reimprimirla por la POS80
//     fabrica un documento no fiscal de una venta fiscal. No se imprime: se
//     devuelve el motivo y el operador va a la maquina fiscal.
//
// Con el servicio fiscal ausente (canal pos80) la reimpresion de una venta
// fiscal tampoco se cae a la POS80: lo que falta es justamente la maquina que
// emitio ese comprobante. Y sin canal detectable el bloqueo se mantiene: la
// falta de deteccion no es un permiso (Regla R7).
//
// Funcion PURA a proposito: el modal resuelve el canal con
// `resolveTerminalChannel()` y este helper decide sin red, sin hardware y sin
// React, para poder probar los cuatro cruces.

import type { DocumentChannelState } from "./fiscal-fallback-flow.ts";

export type SaleDocumentKind = "fiscal" | "no_fiscal";

/**
 * Lo unico que hay que saber de la orden para decidir. Campo por campo:
 *  - `numeroControlInterno`: lo completa la venta local fiscal con el COO de la
 *    maquina y el fallback de la POS80 con su numero sintetico `NF...`.
 *  - `facturacion.numero_control` / `numeroControl`: mismo par de fuentes que
 *    usa `buildSaleReprintTicket` (la venta digital deja aca el COO).
 *  - `facturacion.resp.numerocontrol`: el COO real que devuelve el backend
 *    cuando la venta la factura el en el camino digital.
 *  - `facturacion.fallback`: marca que el comprobante lo sintetizo la POS80
 *    (`applyFallbackInvoiceToOrder` en `fiscal-fallback.ts`).
 */
export interface ReprintOrderShape {
  id?: string | null;
  numeroControlInterno?: string | null;
  facturacion?: {
    numero_control?: string | null;
    numeroControl?: string | null;
    fallback?: boolean | null;
    resp?: { numerocontrol?: string | null } | null;
  } | null;
}

/** Prefijo de los numeros de control que sintetiza la POS80 (`synthesizeFiscalNumber`). */
const NON_FISCAL_PREFIX = "NF";

/**
 * Numero de control del comprobante original, con el mismo orden de fuentes que
 * `buildSaleReprintTicket`. NO cae al `id` de la orden: un id no es un numero de
 * control y usarlo convertiria cualquier fila sin comprobante en "venta fiscal".
 */
export function reprintControlNumber(order: ReprintOrderShape): string {
  const fac = order.facturacion;
  return String(
    fac?.numero_control ||
      fac?.numeroControl ||
      fac?.resp?.numerocontrol ||
      order.numeroControlInterno ||
      "",
  ).trim();
}

/**
 * Que tipo de comprobante emitio esta venta. La evidencia de un COO real manda:
 * la venta digital no llena `numeroControlInterno` y aun asi es fiscal.
 *
 * Sin ningun numero de control no hay documento fiscal que reusar: se trata
 * como no fiscal (es el caso del papel que la POS80 emitio sin numero o de una
 * orden que nunca emitio comprobante).
 */
export function saleDocumentKind(order: ReprintOrderShape): SaleDocumentKind {
  if (order.facturacion?.fallback === true) return "no_fiscal";
  const control = reprintControlNumber(order);
  if (!control) return "no_fiscal";
  // Los COO fiscales son numericos ("00009876"): el prefijo NF no colisiona.
  return control.toUpperCase().startsWith(NON_FISCAL_PREFIX) ? "no_fiscal" : "fiscal";
}

/**
 * Motivo por el que esta venta NO se puede reimprimir por la POS80, o `null`
 * cuando la reimpresion por POS80 es el papel correcto.
 *
 * El motivo del canal se agrega solo cuando aporta (`ready !== true`): con la
 * terminal lista, `ChannelDecision.reason` es informativo y repetirlo en el
 * error confunde.
 */
export function reprintBlockReason(
  order: ReprintOrderShape,
  channel?: DocumentChannelState | null,
): string | null {
  // Venta no fiscal: el papel que se reimprime es el que la POS80 ya emitio.
  if (saleDocumentKind(order) === "no_fiscal") return null;

  const control = reprintControlNumber(order);
  const reference = control ? ` (${control})` : "";

  if (channel?.channel === "fiscal") {
    const detail = channel.ready === true ? undefined : channel.reason?.trim();
    return `Esta venta tiene comprobante fiscal${reference}: la reimpresión tiene que salir por la máquina fiscal. El servicio fiscal está activo en esta terminal, así que no se imprime por la POS80${
      detail ? ` (${detail})` : ""
    }.`;
  }

  if (channel?.channel === "pos80") {
    return `Esta venta tiene comprobante fiscal${reference}: la reimpresión no puede salir por la POS80, que fabricaría un documento no fiscal de una venta fiscal. El servicio fiscal no está disponible en esta terminal, así que falta la máquina fiscal que emitió ese comprobante.`;
  }

  // Sin canal detectable: no saber el canal no habilita el otro papel.
  return `Esta venta tiene comprobante fiscal${reference}: la reimpresión tiene que salir por la máquina fiscal y el canal de esta terminal no se pudo detectar. No se imprime por la POS80.`;
}
