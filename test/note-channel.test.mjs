/**
 * Canal de los documentos DERIVADOS: nota de credito, X y Z
 * (`odd/tasks/canal-comprobante-por-caja.md`, T11, Specs S3 y R7).
 *
 * La regla es la misma que la de la venta: el canal se DETECTA y ningun
 * documento cruza al otro canal.
 *
 *   canal pos80 (servicio fiscal ausente) -> el documento sale por la POS80
 *   canal fiscal (servicio vivo)          -> lo emite la maquina fiscal; si
 *                                            falla, error con el motivo y CERO
 *                                            impresiones por la POS80
 *
 * Los dialogos son componentes React (JSX): `node --test` no los monta sin DOM,
 * asi que aca se pinnea el helper PURO del flow alimentado con la decision REAL
 * de `resolveSaleChannel()` (seams inyectados: sin red, sin WebUSB y sin
 * servicio fiscal). El wiring de cada dialogo se verifica con `tsc` y `eslint`.
 *
 * Run: node --experimental-strip-types --test test/note-channel.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  describeNoteFallbackOutcome,
  documentChannelBlockReason,
  printZReportFallback,
  runNoteFallback,
  runXReportFallback,
} from "../modules/cash-register/lib/fiscal-fallback-flow.ts";
import { resolveSaleChannel } from "../modules/cash-register/lib/channel-detect.ts";
import { renderNoFiscalTicket } from "../modules/cash-register/lib/pos80-print.ts";

// Sin esperas entre lecturas de confirmacion: los tests no pausan el proceso.
const FAST = { absenceAttempts: 1, confirmDelayMs: 0 };

const HEADER = { name: "Farmacia Test", rif: "J-12345678-9" };

/** Seams de la terminal: servicio vivo, maquina ok, POS80 emparejada. */
function seams(overrides = {}) {
  return {
    health: async () => ({ status: "ok" }),
    printerStatus: async () => ({ status: "ok" }),
    pos80Paired: async () => true,
    ...overrides,
  };
}

/** Terminal sin servicio fiscal: `/health` no responde. */
const SIN_SERVICIO = {
  health: async () => {
    throw new Error("connection refused");
  },
};

/** Servicio fiscal vivo con la maquina muda. */
const MAQUINA_MUDA = {
  printerStatus: async () => {
    throw new Error("la impresora no respondió");
  },
};

/** Impresora POS80 doble: cuenta impresiones y devuelve el papel que "sale". */
function pos80Spy(result = { printed: true, via: "usb" }) {
  const tickets = [];
  const print = async (ticket) => {
    tickets.push(ticket);
    return result;
  };
  return { print, tickets };
}

function noteInputs(overrides = {}) {
  return {
    header: HEADER,
    payload: { id_pharmacy: "PH1", factura_id: "F-1" },
    createNote: async () => ({ success: true }),
    affectedDocument: "F-1",
    total: 12.5,
    ...overrides,
  };
}

function zInputs(overrides = {}) {
  return {
    header: HEADER,
    pharmacyId: "PH1",
    sessionInvoices: [],
    print: pos80Spy().print,
    ...overrides,
  };
}

// --- Escenario 1: canal POS80 (servicio fiscal ausente) ----------------------

test("canal POS80: la nota de credito se imprime en la POS80 y se persiste", async () => {
  const decision = await resolveSaleChannel(seams(SIN_SERVICIO), FAST);
  assert.equal(decision.channel, "pos80", "sin servicio fiscal el canal es POS80");

  const pos80 = pos80Spy();
  const created = [];
  const outcome = await runNoteFallback(
    noteInputs({
      channel: decision,
      print: pos80.print,
      createNote: async (payload) => {
        created.push(payload);
        return { success: true };
      },
    }),
  );

  assert.equal(pos80.tickets.length, 1, "el papel sale por la POS80");
  assert.equal(pos80.tickets[0].kind, "credit-note");
  const text = Buffer.from(renderNoFiscalTicket(pos80.tickets[0])).toString("latin1");
  assert.ok(text.includes("NOTA DE CREDITO"), "el papel se identifica como nota de credito");
  assert.ok(text.includes("Afecta: F-1"), "conserva el documento afectado");

  assert.equal(outcome.printed, true, "el helper informa que el papel salio");
  assert.equal(outcome.persisted, true, "el helper informa que la nota quedo guardada");
  assert.equal(typeof outcome.numero_control, "string");
  assert.equal(created.length, 1, "el reintento de persistencia corre una sola vez");
  assert.equal(created[0].tracking_id, outcome.tracking_id);
  assert.equal(created[0].numero_control_interno, outcome.numero_control);
  assert.equal(outcome.blockedReason, undefined, "en canal POS80 no hay nada bloqueado");
});

test("canal POS80 con la POS80 muda: no hay papel, el motivo concreto y la nota no se da por impresa", async () => {
  const decision = await resolveSaleChannel(seams(SIN_SERVICIO), FAST);
  const pos80 = pos80Spy({ printed: false, via: "usb", error: "La impresora POS80 no esta conectada" });

  const outcome = await runNoteFallback(noteInputs({ channel: decision, print: pos80.print }));

  assert.equal(pos80.tickets.length, 1, "se intento imprimir por el unico canal que existe");
  assert.equal(outcome.printed, false);
  assert.match(outcome.printError, /no esta conectada/i, "conserva el motivo de la POS80");
});

// --- Escenario 2: canal fiscal con la maquina fallando ----------------------

test("canal fiscal con la maquina muda: error con el motivo y CERO impresiones POS80", async () => {
  const decision = await resolveSaleChannel(seams(MAQUINA_MUDA), FAST);
  assert.equal(decision.channel, "fiscal", "un fallo de la maquina no cambia el canal (S3)");
  assert.equal(decision.ready, false);

  const pos80 = pos80Spy();
  let creates = 0;
  const outcome = await runNoteFallback(
    noteInputs({
      channel: decision,
      print: pos80.print,
      createNote: async () => {
        creates += 1;
        return { success: true };
      },
    }),
  );

  assert.equal(pos80.tickets.length, 0, "la POS80 NO se toca: no hay fallback cruzado (R7)");
  assert.equal(creates, 0, "no se persiste una nota que no salio por ningun canal");
  assert.equal(outcome.printed, false);
  assert.equal(outcome.persisted, false);

  assert.match(outcome.blockedReason, /servicio fiscal está activo/i, "dice por que no se imprimio");
  assert.match(outcome.blockedReason, /máquina fiscal/i, "nombra el canal que corresponde");
  assert.match(outcome.blockedReason, /no respondió/i, "conserva el motivo concreto (S6)");
  assert.match(outcome.blockedReason, /nota de crédito/i, "nombra el documento");
});

// --- Escenario 3: canal fiscal con la maquina ok ----------------------------

test("canal fiscal con la maquina ok: el comprobante lo emite la maquina fiscal y la POS80 no se toca", async () => {
  const decision = await resolveSaleChannel(seams(), FAST);
  assert.equal(decision.channel, "fiscal");
  assert.equal(decision.ready, true, "la maquina responde: el canal fiscal puede emitir");

  const pos80 = pos80Spy();
  const outcome = await runNoteFallback(noteInputs({ channel: decision, print: pos80.print }));

  assert.equal(pos80.tickets.length, 0, "el camino fiscal no imprime por la POS80");
  assert.equal(outcome.printed, false);
  assert.doesNotMatch(
    documentChannelBlockReason("la nota de crédito", decision) ?? "",
    /no respondió/i,
    "con la maquina ok no hay fallo que informar: el documento sale por la maquina fiscal",
  );
});

// --- Preservacion: sin canal declarado el helper sigue imprimiendo ----------

test("sin canal declarado el helper mantiene la impresion por POS80 (comportamiento historico)", async () => {
  const pos80 = pos80Spy();
  const outcome = await runNoteFallback(noteInputs({ print: pos80.print }));

  assert.equal(pos80.tickets.length, 1);
  assert.equal(outcome.printed, true);
  assert.equal(outcome.persisted, true);
});

// --- Cierres: el Z y el X tampoco cruzan de canal ---------------------------
test("el Z no cruza de canal: con el servicio fiscal vivo no se imprime por la POS80", async () => {
  const decision = await resolveSaleChannel(seams(MAQUINA_MUDA), FAST);
  const pos80 = pos80Spy();

  const outcome = await printZReportFallback(zInputs({ channel: decision, print: pos80.print }));

  assert.equal(pos80.tickets.length, 0, "el cierre no inventa un Z de POS80 (R7)");
  assert.equal(outcome.printed, false);
  assert.match(outcome.error, /máquina fiscal/i, "el cierre dice por que no salio");
  assert.match(outcome.error, /no respondió/i);
});

test("el Z sale por la POS80 cuando el servicio fiscal no esta", async () => {
  const decision = await resolveSaleChannel(seams(SIN_SERVICIO), FAST);
  const pos80 = pos80Spy();

  const outcome = await printZReportFallback(zInputs({ channel: decision, print: pos80.print }));

  assert.equal(pos80.tickets.length, 1);
  assert.equal(pos80.tickets[0].title, "REPORTE Z");
  assert.equal(outcome.printed, true);
  assert.equal(outcome.error, undefined);
});

test("el X no cruza de canal: con el servicio fiscal vivo no se imprime por la POS80", async () => {
  const decision = await resolveSaleChannel(seams(MAQUINA_MUDA), FAST);
  const pos80 = pos80Spy();

  const outcome = await runXReportFallback(zInputs({ channel: decision, print: pos80.print }));

  assert.equal(pos80.tickets.length, 0);
  assert.equal(outcome.printed, false);
  assert.match(outcome.error, /máquina fiscal/i);
});

test("el X sale por la POS80 cuando el servicio fiscal no esta", async () => {
  const decision = await resolveSaleChannel(seams(SIN_SERVICIO), FAST);
  const pos80 = pos80Spy();

  const outcome = await runXReportFallback(zInputs({ channel: decision, print: pos80.print }));

  assert.equal(pos80.tickets.length, 1);
  assert.equal(pos80.tickets[0].title, "REPORTE X");
  assert.equal(outcome.printed, true);
});

// --- NC de la caja (`modules/orders/components/FiscalNoteDialog.tsx`) -------
//
// El dialogo es JSX: `node --test` no lo monta sin DOM. La DECISION que toma
// despues del fallback (que se le dice al operador) vive en el flow puro
// (`describeNoteFallbackOutcome`), que es lo que se cubre aca; el ruteo del
// componente se verifica con `tsc` y `eslint`.

test("NC de la caja, canal POS80: imprime, persiste y recien ahi se anuncia emitida", async () => {
  const decision = await resolveSaleChannel(seams(SIN_SERVICIO), FAST);
  const pos80 = pos80Spy();

  const outcome = await runNoteFallback(noteInputs({ channel: decision, print: pos80.print }));
  const display = describeNoteFallbackOutcome(outcome);

  assert.equal(pos80.tickets.length, 1, "el papel sale por la POS80");
  assert.equal(outcome.printed, true);
  assert.equal(outcome.persisted, true);
  assert.equal(display.ok, true);
  assert.match(display.message, /Nota de Crédito emitida/);
  assert.ok(display.message.includes(outcome.numero_control), "muestra el control que salió en el papel");
});

test("NC de la caja, canal fiscal con la maquina muda: motivo, cero impresiones POS80 y NO se anuncia emitida", async () => {
  const decision = await resolveSaleChannel(seams(MAQUINA_MUDA), FAST);
  assert.equal(decision.channel, "fiscal");

  const pos80 = pos80Spy();
  const outcome = await runNoteFallback(noteInputs({ channel: decision, print: pos80.print }));
  const display = describeNoteFallbackOutcome(outcome);

  assert.equal(pos80.tickets.length, 0, "la POS80 no imprime con el servicio fiscal vivo");
  assert.equal(outcome.printed, false);
  assert.equal(outcome.persisted, false);
  assert.equal(display.ok, false, "sin papel ni registro no se puede anunciar la nota");
  assert.match(display.message, /servicio fiscal está activo/i);
  assert.match(display.message, /no respondió/i, "muestra el motivo concreto (S6)");
  assert.doesNotMatch(display.message, /emitida/i, "no afirma que la nota salió");
});

test("NC de la caja, canal fiscal con la maquina ok: el comprobante lo emite la maquina fiscal y la POS80 queda intacta", async () => {
  const decision = await resolveSaleChannel(seams(), FAST);
  assert.equal(decision.channel, "fiscal");
  assert.equal(decision.ready, true);

  const pos80 = pos80Spy();
  const outcome = await runNoteFallback(noteInputs({ channel: decision, print: pos80.print }));
  const display = describeNoteFallbackOutcome(outcome);

  assert.equal(pos80.tickets.length, 0, "el camino fiscal no toca la POS80");
  assert.equal(outcome.printed, false);
  assert.equal(display.ok, false);
  assert.doesNotMatch(display.message, /no respondió/i, "no hay fallo de máquina que informar");
  assert.match(display.message, /máquina fiscal/i, "dice por qué canal tiene que salir");
});

test("NC de la caja: papel impreso sin registro NO se anuncia emitida (R6, dirección inversa)", async () => {
  const decision = await resolveSaleChannel(seams(SIN_SERVICIO), FAST);
  const pos80 = pos80Spy();

  const outcome = await runNoteFallback(
    noteInputs({
      channel: decision,
      print: pos80.print,
      createNote: async () => {
        throw new Error("el backend rechazó la nota");
      },
    }),
  );
  const display = describeNoteFallbackOutcome(outcome);

  assert.equal(pos80.tickets.length, 1, "el papel ya salió");
  assert.equal(outcome.printed, true);
  assert.equal(outcome.persisted, false, "y el sistema NO la registró");
  assert.equal(display.ok, false);
  assert.match(display.message, /no quedó registrada/i);
  assert.match(display.message, /el backend rechazó la nota/i, "conserva el motivo del backend");
  assert.match(display.message, /no vuelvas a emitir/i, "no invita a duplicar el comprobante");
});
