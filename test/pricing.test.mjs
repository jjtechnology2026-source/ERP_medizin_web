import test from "node:test";
import assert from "node:assert/strict";
import { isValidProfit, sellingPrice, costFromPrice, bulkSellingPrice } from "../modules/products/lib/pricing.ts";

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("isValidProfit acepta [0, 100) y rechaza 100, negativos y NaN", () => {
  assert.equal(isValidProfit(0), true);
  assert.equal(isValidProfit(30), true);
  assert.equal(isValidProfit(99.99), true);
  assert.equal(isValidProfit(100), false);
  assert.equal(isValidProfit(-1), false);
  assert.equal(isValidProfit(NaN), false);
});

test("sellingPrice usa margen sobre precio de venta: costo/(1-u)*(1+iva)", () => {
  assert.ok(close(sellingPrice(10, 30, 0), 14.285714285714286));
  assert.ok(close(sellingPrice(10, 30, 16), 16.571428571428573));
  assert.ok(close(sellingPrice(10, 0, 16), 11.6));
});

test("sellingPrice: ejemplo de Jir (10 con 30% = 14.2857)", () => {
  assert.ok(close(sellingPrice(10, 30, 0), 10 / (1 - 0.3)));
});

test("sellingPrice devuelve NaN si la utilidad es >= 100 o invalida", () => {
  assert.ok(Number.isNaN(sellingPrice(10, 100, 16)));
  assert.ok(Number.isNaN(sellingPrice(10, -1, 16)));
  assert.ok(Number.isNaN(sellingPrice(10, NaN, 16)));
});

test("costFromPrice invierte sellingPrice (round-trip)", () => {
  const price = sellingPrice(10, 30, 16);
  assert.ok(close(costFromPrice(price, 30, 16), 10, 1e-9));
});

test("costFromPrice devuelve el price sin tocar si la utilidad es invalida", () => {
  assert.equal(costFromPrice(14.28, 100, 16), 14.28);
});

test("bulkSellingPrice (carga masiva) usa margen + IVA y redondea a 2 decimales", () => {
  assert.equal(bulkSellingPrice(10, 30, 16), 16.57);
  assert.equal(bulkSellingPrice(10, 0, 16), 11.6);
  assert.equal(bulkSellingPrice(10, 30), 16.57);
  assert.equal(bulkSellingPrice(10, 0, 0), 10);
});

test("bulkSellingPrice devuelve undefined sin base y NaN con utilidad invalida", () => {
  assert.equal(bulkSellingPrice(undefined, 30, 16), undefined);
  assert.ok(Number.isNaN(bulkSellingPrice(10, 100, 16)));
});
