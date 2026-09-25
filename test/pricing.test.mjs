import test from "node:test";
import assert from "node:assert/strict";
import { isValidProfit, sellingPrice, costFromPrice, bulkSellingPrice, taxBreakdown, derivePrice, effectiveVat, parseVatInput, displayedChargePrice, DEFAULT_VAT_PCT } from "../modules/products/lib/pricing.ts";
import { toBs2, fiscalUnitPriceBs } from "../modules/cash-register/lib/money.ts";

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
  // Explicit-zero-VAT contract: absent VAT now defaults to 0%, not 16%.
  assert.equal(bulkSellingPrice(10, 30), 14.29);
  assert.equal(bulkSellingPrice(10, 30, 0), 14.29);
  assert.equal(bulkSellingPrice(10, 0, 0), 10);
});

test("bulkSellingPrice devuelve undefined sin base y NaN con utilidad invalida", () => {
  assert.equal(bulkSellingPrice(undefined, 30, 16), undefined);
  assert.ok(Number.isNaN(bulkSellingPrice(10, 100, 16)));
});

test("DEFAULT_VAT_PCT es 0 (fallback documentado, explícito 0 se preserva)", () => {
  assert.equal(DEFAULT_VAT_PCT, 0);
});

test("effectiveVat: valor finito gana; ausente/NaN/negativo-ausente cae al default 0", () => {
  assert.equal(effectiveVat(undefined), 0);
  assert.equal(effectiveVat(null), 0);
  assert.equal(effectiveVat(NaN), 0);
  assert.equal(effectiveVat(0), 0, "el 0 explícito es un valor");
  assert.equal(effectiveVat(8), 8);
  assert.equal(effectiveVat(16), 16);
});

test("parseVatInput: vacío -> undefined (ausente), '0' -> 0 (explícito se preserva)", () => {
  assert.equal(parseVatInput(""), undefined);
  assert.equal(parseVatInput("   "), undefined);
  assert.equal(parseVatInput(null), undefined);
  assert.equal(parseVatInput(undefined), undefined);
  assert.equal(parseVatInput("0"), 0, "un 0% legítimo debe sobrevivir");
  assert.equal(parseVatInput("16"), 16);
  assert.equal(parseVatInput("8.5"), 8.5);
  assert.equal(parseVatInput("abc"), undefined);
});

test("derivePrice: vectores de paridad con el backend (incluye descuento)", () => {
  assert.equal(derivePrice(0.8, 40, 0, 0), 1.33);
  assert.equal(derivePrice(0.8, 40, 16, 0), 1.55);
  assert.equal(derivePrice(10, 30, 16, 0), 16.57);
  assert.equal(derivePrice(10, 0, 16, 0), 11.6);
  assert.equal(derivePrice(0.8, 40, 0, 10), 1.2);
  assert.equal(derivePrice(10, 30, 16, 10), 14.91);
  // VAT ausente -> default 0; descuento ausente -> 0.
  assert.equal(derivePrice(10, 30), 14.29);
  assert.equal(derivePrice(10, 30, undefined, 10), 12.86);
});

test("derivePrice: sin base devuelve undefined; utilidad inválida propaga NaN", () => {
  assert.equal(derivePrice(undefined, 30, 16), undefined);
  assert.ok(Number.isNaN(derivePrice(10, 100, 16)));
});

test("displayedChargePrice lee el mismo med.price que fiscalUnitPriceBs (panel == caja)", () => {
  const rate = 0.36;
  const med = { price: 15.55 };
  assert.equal(displayedChargePrice(med), 15.55);
  assert.equal(
    toBs2(displayedChargePrice(med) * rate),
    fiscalUnitPriceBs(med.price, rate),
    "el panel y la caja deben derivar de med.price"
  );
  assert.equal(displayedChargePrice({}), 0);
  assert.equal(displayedChargePrice(null), 0);
  assert.equal(displayedChargePrice(undefined), 0);
});

test("taxBreakdown extrae el IVA del precio final (no lo suma por encima)", () => {
  const b = taxBreakdown(5.48, 16, 4.72);
  assert.ok(close(b.saleNoVat, 5.48 / 1.16));
  assert.ok(close(b.iva, 5.48 - 5.48 / 1.16));
  assert.ok(close(b.iva, 0.7558620689655171));
  assert.ok(close(b.cost, 4.72));
  assert.ok(close(b.profit, 5.48 / 1.16 - 4.72));
  assert.equal(b.final, 5.48);
});

test("taxBreakdown cuadra con el caso costo 3.29 + 40% + IVA 16% (6.36)", () => {
  const final = sellingPrice(3.29, 40, 16);
  const b = taxBreakdown(final, 16, 3.29);
  assert.ok(close(b.saleNoVat, 3.29 / (1 - 0.4)));
  assert.ok(close(b.profit, 2.1933333333333334));
  assert.ok(close(b.iva, b.saleNoVat * 0.16));
  assert.ok(close(b.cost + b.profit + b.iva, b.final));
});

test("taxBreakdown sin costo asume ganancia 0 y sin IVA el neto es el final", () => {
  const sinCosto = taxBreakdown(10, 16);
  assert.ok(close(sinCosto.cost, 10 / 1.16));
  assert.ok(close(sinCosto.profit, 0));
  const sinIva = taxBreakdown(10, 0, 4);
  assert.equal(sinIva.saleNoVat, 10);
  assert.equal(sinIva.iva, 0);
  assert.equal(sinIva.profit, 6);
});
