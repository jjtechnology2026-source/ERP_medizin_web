/**
 * Reimpresión de una venta: el último documento derivado que todavía cruzaba de
 * canal (`odd/tasks/canal-comprobante-por-caja.md`, T11, Specs S3 y R7).
 *
 * La regla tiene DOS casos legítimos que no se pueden confundir:
 *
 *   venta NO fiscal (la emitió esta misma POS80) -> reimprimirla por la POS80 es
 *     correcto en CUALQUIER canal: el papel que se reusa ya era no fiscal.
 *   venta FISCAL (tiene el COO real de la máquina) -> reimprimirla por la POS80
 *     fabrica un documento no fiscal de una venta fiscal. Se bloquea con el
 *     motivo y no se imprime nada.
 *
 * El límite que se prueba acá es el contrato del helper: la orden y la decisión
 * de canal (`DocumentChannelState`: `channel`, `ready`, `reason`). La decisión se
 * construye literal a propósito —qué la produce (`resolveTerminalChannel()`) y
 * con qué histéresis es contrato de `channel-detect.test.mjs`— así que este test
 * no depende de la red, del WebUSB ni del servicio fiscal. El wiring del modal
 * (`OrderDetailModal.handleReprint`) es JSX y se verifica con `tsc` y `eslint`.
 *
 * Run: node --experimental-strip-types --test test/reprint-channel.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  reprintBlockReason,
  reprintControlNumber,
  saleDocumentKind,
} from "../modules/cash-register/lib/reprint-channel.ts";

/** Terminal con el servicio fiscal vivo y la máquina fiscal respondiendo. */
const CANAL_FISCAL = { channel: "fiscal", ready: true, reason: "El servicio fiscal está activo en esta terminal." };

/** Terminal con el servicio fiscal vivo pero la máquina muda. */
const CANAL_FISCAL_MAQUINA_MUDA = {
  channel: "fiscal",
  ready: false,
  reason:
    "El servicio fiscal está activo pero la máquina fiscal no respondió: la impresora no respondió. No se emitió comprobante.",
};

/** Terminal sin servicio fiscal: el único papel que existe es la POS80. */
const CANAL_POS80 = {
  channel: "pos80",
  ready: true,
  reason: "El servicio fiscal no está instalado o no responde. El comprobante sale por la POS80.",
};

/** Venta fiscal local: la máquina fiscal emitió el COO real. */
const FISCAL_ORDER = {
  id: "ord-fiscal",
  date: "2026-11-18T15:30:45.000Z",
  numeroControlInterno: "00009876",
  serieFiscal: "SERIE-A",
  facturacion: {
    success: true,
    numero_control: "00009876",
    numeroControl: "00009876",
    resp: { numerointerno: "1234", numerocontrol: "00009876", serie: "SERIE-A" },
    error: null,
  },
};

/** Venta fiscal digital: el backend emitió el COO y no llenó `numeroControlInterno`. */
const FISCAL_DIGITAL_ORDER = {
  id: "ord-digital",
  date: "2026-11-18T15:30:45.000Z",
  numeroControlInterno: null,
  facturacion: {
    success: true,
    numero_control: null,
    resp: { numerointerno: "7788", numerocontrol: "00009999", serie: "SERIE-A" },
    error: null,
  },
};

/** Venta NO fiscal: la emitió esta POS80 (`facturacion.fallback === true`). */
const POS80_ORDER = {
  id: "ord-pos80",
  date: "2026-11-18T15:30:45.000Z",
  numeroControlInterno: "NF000000000123",
  facturacion: {
    success: true,
    numero_control: "NF000000000123",
    numeroControl: "NF000000000123",
    fallback: true,
    resp: { numerointerno: "", numerocontrol: "NF000000000123", serie: "NF" },
    error: null,
  },
};

/** Venta NO fiscal reconocible por el prefijo `NF`, sin el flag del fallback. */
const POS80_ORDER_SIN_FLAG = {
  id: "ord-pos80-sin-flag",
  numeroControlInterno: "NF000000000777",
  facturacion: { success: true, numero_control: null, resp: null, error: null },
};

/** Venta sin ningún número de control: no hay documento fiscal que reusar. */
const SIN_NUMERO_ORDER = {
  id: "ord-sin-numero",
  numeroControlInterno: null,
  facturacion: { success: false, numero_control: null, numeroControl: null, resp: null, error: "x" },
};

// --- Clasificación del comprobante original -----------------------------------

test("saleDocumentKind: el COO real de la máquina es una venta fiscal", () => {
  assert.equal(saleDocumentKind(FISCAL_ORDER), "fiscal");
  assert.equal(reprintControlNumber(FISCAL_ORDER), "00009876");
});

test("saleDocumentKind: el COO que sólo está en `facturacion.resp` también es fiscal", () => {
  // Venta digital: el backend emite y no completa `numeroControlInterno`. Leer
  // sólo ese campo clasificaría una venta fiscal como no fiscal y habilitaría
  // justamente el papel que R7 prohíbe.
  assert.equal(saleDocumentKind(FISCAL_DIGITAL_ORDER), "fiscal");
  assert.equal(reprintControlNumber(FISCAL_DIGITAL_ORDER), "00009999");
});

test("saleDocumentKind: fallback de la POS80, prefijo NF y sin número no son fiscales", () => {
  assert.equal(saleDocumentKind(POS80_ORDER), "no_fiscal");
  assert.equal(saleDocumentKind(POS80_ORDER_SIN_FLAG), "no_fiscal");
  assert.equal(saleDocumentKind(SIN_NUMERO_ORDER), "no_fiscal");
  assert.equal(reprintControlNumber(SIN_NUMERO_ORDER), "");
});

// --- Los cuatro cruces de canal ----------------------------------------------

test("venta fiscal × canal fiscal: bloquea y manda a la máquina fiscal", () => {
  assert.equal(
    reprintBlockReason(FISCAL_ORDER, CANAL_FISCAL),
    "Esta venta tiene comprobante fiscal (00009876): la reimpresión tiene que salir " +
      "por la máquina fiscal. El servicio fiscal está activo en esta terminal, así que " +
      "no se imprime por la POS80.",
  );
});

test("venta fiscal × canal fiscal con la máquina muda: bloquea y dice qué falta", () => {
  assert.equal(CANAL_FISCAL_MAQUINA_MUDA.ready, false);
  assert.equal(
    reprintBlockReason(FISCAL_ORDER, CANAL_FISCAL_MAQUINA_MUDA),
    "Esta venta tiene comprobante fiscal (00009876): la reimpresión tiene que salir " +
      "por la máquina fiscal. El servicio fiscal está activo en esta terminal, así que " +
      "no se imprime por la POS80 (El servicio fiscal está activo pero la máquina fiscal " +
      "no respondió: la impresora no respondió. No se emitió comprobante.).",
  );
});

test("venta fiscal × canal pos80: tampoco se fabrica un no fiscal, y el motivo nombra la máquina", () => {
  assert.equal(
    reprintBlockReason(FISCAL_ORDER, CANAL_POS80),
    "Esta venta tiene comprobante fiscal (00009876): la reimpresión no puede salir " +
      "por la POS80, que fabricaría un documento no fiscal de una venta fiscal. El " +
      "servicio fiscal no está disponible en esta terminal, así que falta la máquina " +
      "fiscal que emitió ese comprobante.",
  );
  // La venta fiscal digital (COO sólo en `facturacion.resp`) cruza igual de mal.
  assert.match(
    reprintBlockReason(FISCAL_DIGITAL_ORDER, CANAL_POS80) ?? "",
    /comprobante fiscal \(00009999\)/,
  );
});

test("venta no fiscal × canal fiscal: reimprimirla por la POS80 es correcto", () => {
  assert.equal(reprintBlockReason(POS80_ORDER, CANAL_FISCAL), null);
});

test("venta no fiscal × canal pos80: reimprimirla por la POS80 es correcto", () => {
  assert.equal(reprintBlockReason(POS80_ORDER, CANAL_POS80), null);
  assert.equal(reprintBlockReason(POS80_ORDER_SIN_FLAG, CANAL_POS80), null);
});

// --- Sin canal detectable -----------------------------------------------------

test("sin canal detectable: la venta fiscal sigue bloqueada, la no fiscal sigue permitida", () => {
  assert.equal(
    reprintBlockReason(FISCAL_ORDER, undefined),
    "Esta venta tiene comprobante fiscal (00009876): la reimpresión tiene que salir " +
      "por la máquina fiscal y el canal de esta terminal no se pudo detectar. No se " +
      "imprime por la POS80.",
  );
  assert.equal(reprintBlockReason(FISCAL_ORDER, null), reprintBlockReason(FISCAL_ORDER, undefined));
  assert.equal(reprintBlockReason(SIN_NUMERO_ORDER, undefined), null);
});
