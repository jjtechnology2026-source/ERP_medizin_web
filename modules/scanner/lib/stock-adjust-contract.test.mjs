import test from "node:test";
import assert from "node:assert/strict";
import {
  STOCK_ADJUST_PERMIT,
  adjustFailure,
  hasStockAdjustPermit,
  unwrapStockAdjustPayload,
} from "./stock-adjust-contract.ts";

// Contrato de `POST /admin/inventory/adjust` (T2, ya implementado en el
// backend) y el permiso de T4/S6.

test("el permiso es el string exacto que exige el backend", () => {
  assert.equal(STOCK_ADJUST_PERMIT, "Ajustar stock desde escáner");
  assert.equal(hasStockAdjustPermit(["Ajustar stock desde escáner"]), true);
  assert.equal(
    hasStockAdjustPermit(["Productos en stock", "Ajustar stock desde escáner"]),
    true,
  );
});

test("un permiso parecido no alcanza: el backend compara el literal", () => {
  for (const casi of [
    "ajustar stock desde escáner",
    "Ajustar stock desde escaner",
    " Ajustar stock desde escáner",
    "Ajustar stock desde escáner ",
    "Ajustar stock",
    "AJUSTAR STOCK DESDE ESCÁNER",
    "",
  ]) {
    assert.equal(hasStockAdjustPermit([casi]), false, `«${casi}» no es el permiso`);
  }
  assert.equal(hasStockAdjustPermit([]), false);
  assert.equal(hasStockAdjustPermit(undefined), false);
  assert.equal(hasStockAdjustPermit(null), false);
});

test("el 200 llega envuelto en el ApiResponse del backend y se desenvuelve", () => {
  assert.deepEqual(
    unwrapStockAdjustPayload({
      success: true,
      data: {
        bar_code: "7591234567890",
        stock_previo: 10,
        stock_nuevo: 13,
        movimiento_id: "movimiento:1",
      },
      error: null,
    }),
    {
      barCode: "7591234567890",
      stockPrevio: 10,
      stockNuevo: 13,
      movimientoId: "movimiento:1",
    },
  );
});

test("un 200 sin envolver tambien se entiende", () => {
  assert.deepEqual(
    unwrapStockAdjustPayload({
      bar_code: "7591234567890",
      stock_previo: 5,
      stock_nuevo: 0,
      movimiento_id: "movimiento:2",
    }),
    {
      barCode: "7591234567890",
      stockPrevio: 5,
      stockNuevo: 0,
      movimientoId: "movimiento:2",
    },
  );
});

test("un 200 al que le falta el stock nuevo no se reporta como ajuste", () => {
  assert.equal(
    unwrapStockAdjustPayload({
      success: true,
      data: { bar_code: "7591234567890", stock_previo: 5, movimiento_id: "m:1" },
    }),
    null,
  );
  assert.equal(
    unwrapStockAdjustPayload({ success: false, data: null, error: "boom" }),
    null,
  );
  assert.equal(unwrapStockAdjustPayload(undefined), null);
  assert.equal(unwrapStockAdjustPayload("ok"), null);
});

test("cada status del contrato tiene su resultado y su copia", () => {
  assert.equal(adjustFailure(403, null).status, "forbidden");
  assert.equal(adjustFailure(404, null).status, "not-found");
  assert.equal(adjustFailure(409, null).status, "conflict");
  assert.equal(adjustFailure(422, null).status, "rejected");
  assert.equal(adjustFailure(500, null).status, "error");
  assert.equal(adjustFailure(0, null).status, "error");

  assert.match(adjustFailure(403, null).message, /permiso/i);
  assert.match(adjustFailure(404, null).message, /inventario/i);
  assert.match(adjustFailure(409, null).message, /volv/i);
  assert.match(adjustFailure(422, null).message, /ajuste/i);
});

test("el motivo del backend gana sobre la copia generica", () => {
  assert.equal(
    adjustFailure(422, { success: false, data: null, error: "delta = 0" }).message,
    "delta = 0",
  );
  assert.equal(
    adjustFailure(409, { message: "El stock se movió" }).message,
    "El stock se movió",
  );
  // Un mensaje vacio o que no es texto cae a la copia propia.
  assert.match(adjustFailure(409, { error: "   " }).message, /volv/i);
  assert.match(adjustFailure(403, { error: { code: 403 } }).message, /permiso/i);
});
