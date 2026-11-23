import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdjustment,
  clampDeltaToStock,
  describeDelta,
  parseTypedDelta,
  stepDelta,
} from "./stock-adjustment.ts";

// T3 de `odd/tasks/scanner-stock-adjust.md`: el delta que se manda al backend
// sale del campo editable o de los botones − / +, y nunca puede dejar el stock
// por debajo de cero (S5).

test("cantidad tipeada: un entero positivo suma y uno negativo resta", () => {
  assert.deepEqual(parseTypedDelta("3"), { ok: true, delta: 3 });
  assert.deepEqual(parseTypedDelta("-3"), { ok: true, delta: -3 });
  assert.deepEqual(parseTypedDelta("  12  "), { ok: true, delta: 12 });
  assert.deepEqual(parseTypedDelta("0"), { ok: true, delta: 0 });
});

test("cantidad tipeada: texto vacio, signo suelto y no numericos se rechazan", () => {
  assert.deepEqual(parseTypedDelta(""), { ok: false, reason: "empty" });
  assert.deepEqual(parseTypedDelta("   "), { ok: false, reason: "empty" });
  assert.deepEqual(parseTypedDelta("-"), { ok: false, reason: "empty" });
  for (const texto of ["abc", "3a", "1.5", "1e3", "+3", "--3", "3-"]) {
    assert.deepEqual(
      parseTypedDelta(texto),
      { ok: false, reason: "not-numeric" },
      `«${texto}» no es un entero`,
    );
  }
});

test("cantidad tipeada: un numero fuera de rango no se manda al backend", () => {
  assert.deepEqual(parseTypedDelta("99999999999999999999"), {
    ok: false,
    reason: "out-of-range",
  });
});

test("botones − / +: cada toque mueve el mismo valor en una unidad", () => {
  assert.equal(stepDelta(0, 1), 1);
  assert.equal(stepDelta(0, -1), -1);
  assert.equal(stepDelta(2, 1), 3);
  assert.equal(stepDelta(2, -1), 1);
  assert.equal(stepDelta(-2, -1), -3);
  assert.equal(stepDelta(-2, 1), -1);
  assert.equal(stepDelta(-1, 1), 0);
});

test("tope contra el stock leido: quitar mas de lo que hay se recorta al stock", () => {
  assert.deepEqual(clampDeltaToStock(-15, 10), {
    delta: -10,
    clamped: true,
    availableStock: 10,
  });
  assert.deepEqual(clampDeltaToStock(-10, 10), {
    delta: -10,
    clamped: false,
    availableStock: 10,
  });
  assert.deepEqual(clampDeltaToStock(5, 10), {
    delta: 5,
    clamped: false,
    availableStock: 10,
  });
});

test("tope contra el stock leido: sin stock no se puede restar nada", () => {
  assert.deepEqual(clampDeltaToStock(-1, 0), {
    delta: 0,
    clamped: true,
    availableStock: 0,
  });
  // Un stock ilegible (NaN) se lee como cero: es preferible no dejar restar de mas.
  assert.deepEqual(clampDeltaToStock(-1, Number.NaN), {
    delta: 0,
    clamped: true,
    availableStock: 0,
  });
});

test("la copia dice cuantas unidades se suman o se quitan", () => {
  assert.equal(describeDelta(3), "Sumar 3 unidades");
  assert.equal(describeDelta(1), "Sumar 1 unidad");
  assert.equal(describeDelta(-3), "Quitar 3 unidades");
  assert.equal(describeDelta(-1), "Quitar 1 unidad");
  assert.equal(describeDelta(0), "Sin cambios");
});

test("borrador: sumar 3 unidades sobre stock 10", () => {
  assert.deepEqual(buildAdjustment("3", 10), {
    delta: 3,
    clamped: false,
    previousStock: 13 - 3,
    resultStock: 13,
    canConfirm: true,
    notice: null,
  });
});

test("borrador: quitar 3 unidades sobre stock 10", () => {
  const draft = buildAdjustment("-3", 10);
  assert.equal(draft.delta, -3);
  assert.equal(draft.previousStock, 10);
  assert.equal(draft.resultStock, 7);
  assert.equal(draft.canConfirm, true);
  assert.equal(draft.notice, null);
});

test("borrador: quitar 15 con stock 10 se recorta, se explica y no se confirma", () => {
  const draft = buildAdjustment("-15", 10);
  assert.equal(draft.delta, -10);
  assert.equal(draft.clamped, true);
  assert.equal(draft.resultStock, 0);
  assert.equal(draft.canConfirm, false);
  assert.match(draft.notice, /10/);
  assert.match(draft.notice, /unidad/);
});

test("borrador: sin stock el unico ajuste posible es sumar", () => {
  const draft = buildAdjustment("-1", 0);
  assert.equal(draft.clamped, true);
  assert.equal(draft.canConfirm, false);
  assert.equal(draft.resultStock, 0);
  assert.match(draft.notice, /no tiene stock/i);
});

test("borrador: cero y texto invalido no se confirman", () => {
  const cero = buildAdjustment("0", 10);
  assert.equal(cero.canConfirm, false);
  assert.equal(cero.delta, 0);
  assert.equal(cero.resultStock, 10);
  assert.match(cero.notice, /unidades/i);

  const vacio = buildAdjustment("", 10);
  assert.equal(vacio.canConfirm, false);
  assert.equal(vacio.resultStock, 10);

  const invalido = buildAdjustment("tres", 10);
  assert.equal(invalido.canConfirm, false);
  assert.equal(invalido.delta, 0);
  assert.equal(invalido.resultStock, 10);
  assert.match(invalido.notice, /entero/i);
});

test("borrador: sumar siempre se puede aunque el stock leido sea ilegible", () => {
  const draft = buildAdjustment("2", Number.NaN);
  assert.equal(draft.previousStock, 0);
  assert.equal(draft.resultStock, 2);
  assert.equal(draft.canConfirm, true);
});
