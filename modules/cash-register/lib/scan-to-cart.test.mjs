import test from "node:test";
import assert from "node:assert/strict";

import {
  cartQuantityAfterAdd,
  defaultScanQuantity,
  parseScanQuantity,
  remainingStock,
  scanAddIssue,
  scanAddIssueMessage,
  stepScanQuantity,
} from "./scan-to-cart.ts";

// Reglas de S5 (`odd/tasks/scan-to-cart.md`): la cantidad se acota al stock
// disponible de la sucursal, se puede escribir o subir de a uno, y una cantidad
// cero no llega nunca al carrito. La lógica es pura (no toca el store ni la
// cámara) para poder probarla sin dispositivo.

test("lo que ya está en la venta descuenta del stock disponible", () => {
  assert.equal(remainingStock(10, 0), 10);
  assert.equal(remainingStock(10, 4), 6);
  assert.equal(remainingStock(10, 10), 0);
});

test("el disponible nunca es negativo, aunque el carrito tenga de más", () => {
  assert.equal(remainingStock(5, 7), 0);
  assert.equal(remainingStock(0, 3), 0);
});

test("stock fraccionario o inválido se redondea hacia abajo, nunca se confía", () => {
  assert.equal(remainingStock(4.9, 0), 4);
  assert.equal(remainingStock(Number.NaN, 0), 0);
  assert.equal(remainingStock(10, Number.NaN), 10);
});

test("la cantidad inicial es 1 con stock y 0 sin stock", () => {
  assert.equal(defaultScanQuantity(6), 1);
  assert.equal(defaultScanQuantity(1), 1);
  assert.equal(defaultScanQuantity(0), 0);
});

test("escribir más que el stock se recorta al stock", () => {
  assert.equal(parseScanQuantity("6", 6), 6);
  assert.equal(parseScanQuantity("99", 6), 6);
});

test("escribir vacío o cero da cero, que es la cantidad que el botón rechaza", () => {
  assert.equal(parseScanQuantity("", 6), 0);
  assert.equal(parseScanQuantity("   ", 6), 0);
  assert.equal(parseScanQuantity("0", 6), 0);
});

test("lo que no es un número termina en cero, nunca en NaN", () => {
  assert.equal(parseScanQuantity("abc", 6), 0);
  assert.equal(parseScanQuantity("-3", 6), 0);
  assert.equal(parseScanQuantity("2.9", 6), 2);
  assert.equal(parseScanQuantity(" 4 ", 6), 4);
});

test("los pasos de − y + quedan dentro de 0..disponible", () => {
  assert.equal(stepScanQuantity(1, 1, 6), 2);
  assert.equal(stepScanQuantity(3, -1, 6), 2);
  assert.equal(stepScanQuantity(6, 1, 6), 6);
  assert.equal(stepScanQuantity(0, -1, 6), 0);
  assert.equal(stepScanQuantity(0, 1, 6), 1);
});

test("sin stock los pasos no inventan una unidad", () => {
  assert.equal(stepScanQuantity(0, 1, 0), 0);
  assert.equal(stepScanQuantity(0, -1, 0), 0);
});

test("cero se rechaza y el mensaje explica por qué", () => {
  assert.equal(scanAddIssue(0, 6), "zero");
  assert.equal(
    scanAddIssueMessage("zero", 6),
    "Elegí al menos 1 unidad para agregarla a la venta.",
  );
});

test("sin stock disponible el rechazo es por stock, no por cantidad", () => {
  assert.equal(scanAddIssue(0, 0), "out-of-stock");
  assert.equal(
    scanAddIssueMessage("out-of-stock", 0),
    "Este producto no tiene stock disponible en la sucursal.",
  );
});

test("pasarse del stock se rechaza aunque el control ya lo impida", () => {
  assert.equal(scanAddIssue(7, 6), "over-stock");
  assert.equal(
    scanAddIssueMessage("over-stock", 6),
    "Sólo podés agregar 6 unidades más de este producto.",
  );
});

test("una cantidad válida no tiene problema que explicar", () => {
  assert.equal(scanAddIssue(1, 1), null);
  assert.equal(scanAddIssue(6, 6), null);
  assert.equal(scanAddIssueMessage(null, 6), null);
});

test("sumar dos veces el mismo producto acumula y achica el disponible", () => {
  // Escanear 3, agregar, volver a escanear: el tope de la segunda pasada es el
  // stock que quedó, no el stock original.
  const afterFirstAdd = cartQuantityAfterAdd(0, 3);
  assert.equal(afterFirstAdd, 3);
  assert.equal(remainingStock(10, afterFirstAdd), 7);

  const afterSecondAdd = cartQuantityAfterAdd(afterFirstAdd, 4);
  assert.equal(afterSecondAdd, 7);
  assert.equal(remainingStock(10, afterSecondAdd), 3);
});

test("un carrito sin datos no rompe la suma acumulada", () => {
  assert.equal(cartQuantityAfterAdd(Number.NaN, 2), 2);
  assert.equal(cartQuantityAfterAdd(2, Number.NaN), 2);
});
