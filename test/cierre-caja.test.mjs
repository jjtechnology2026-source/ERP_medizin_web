import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCierreBalances,
  buildFiscalResumen,
  buildMethodTotals,
  buildUsdTotal,
  computeDifference,
  resolveTheoreticalBalance,
  sumMethodTotals,
} from "../modules/cash-register/lib/cierre-caja.ts";

// --- Bug 1: neto por metodo y divisa ---

test("neto por metodo: la devolucion resta del bucket del metodo", () => {
  const transactions = [
    { type: "sale", method: "tarjeta", currency: "VES", amountVes: 106197.57 },
    { type: "sale", method: "efectivo", currency: "VES", amountVes: 601.34 },
    { type: "sale", method: "pagomovil", currency: "VES", amountVes: 1314.36 },
    { type: "refund", method: "tarjeta", currency: "VES", amountVes: 26587.91 },
  ];

  const totals = buildMethodTotals(transactions);

  assert.equal(totals.tarjeta, 79609.66);
  assert.equal(totals.efectivo, 601.34);
  assert.equal(totals.pagomovil, 1314.36);
  assert.equal(sumMethodTotals(totals), 108113.27 - 26587.91);
  assert.equal(sumMethodTotals(totals), 81525.36);
});

test("neto USD: la devolucion en divisas resta del total USD", () => {
  const transactions = [
    { type: "sale", method: "dolares", currency: "USD", amountVes: 1000, originalAmount: 27.4 },
    { type: "refund", method: "dolares", currency: "USD", amountVes: 400, originalAmount: 10 },
  ];

  assert.equal(buildUsdTotal(transactions), 17.4);
});

test("anulada: no cuenta ni la venta ni la devolucion", () => {
  const transactions = [
    { type: "sale", method: "tarjeta", currency: "VES", amountVes: 100 },
    { type: "sale", method: "tarjeta", currency: "VES", amountVes: 50, voided: true },
    { type: "refund", method: "tarjeta", currency: "VES", amountVes: 30, voided: true },
    { type: "sale", method: "dolares", currency: "USD", amountVes: 200, originalAmount: 5, voided: true },
  ];

  const totals = buildMethodTotals(transactions);

  assert.equal(totals.tarjeta, 100);
  assert.equal(sumMethodTotals(totals), 100);
  assert.equal(buildUsdTotal(transactions), 0);
});

test("diferencia: usa el saldo teorico autoritativo y no la suma aditiva vieja", () => {
  const transactions = [
    { type: "sale", method: "tarjeta", currency: "VES", amountVes: 106197.57 },
    { type: "sale", method: "efectivo", currency: "VES", amountVes: 601.34 },
    { type: "sale", method: "pagomovil", currency: "VES", amountVes: 1314.36 },
    { type: "refund", method: "tarjeta", currency: "VES", amountVes: 26587.91 },
  ];

  const balances = buildCierreBalances({
    transactions,
    openingAmountVes: 0,
    authoritativeVes: 81525.36,
  });

  assert.equal(balances.theoreticalBalanceVes, 81525.36);
  const difference = computeDifference(54864.78, balances.theoreticalBalanceVes);
  assert.equal(difference, -26660.58);
  // El resultado viejo (neto local + devolucion sumada) habria sido -79836.40.
  assert.notEqual(difference, 54864.78 - 134701.18);
});

test("fallback: sin saldo autoritativo usa el neto local, nunca la suma aditiva", () => {
  const transactions = [
    { type: "sale", method: "tarjeta", currency: "VES", amountVes: 106197.57 },
    { type: "sale", method: "efectivo", currency: "VES", amountVes: 601.34 },
    { type: "sale", method: "pagomovil", currency: "VES", amountVes: 1314.36 },
    { type: "refund", method: "tarjeta", currency: "VES", amountVes: 26587.91 },
  ];

  const balances = buildCierreBalances({
    transactions,
    openingAmountVes: 0,
    authoritativeVes: null,
  });

  assert.equal(balances.theoreticalBalanceVes, 81525.36);
  assert.notEqual(balances.theoreticalBalanceVes, 134701.18);
});

test("resolveTheoreticalBalance: ausente/cero con transacciones cae al respaldo", () => {
  assert.equal(resolveTheoreticalBalance(0, 81525.36, true), 81525.36);
  assert.equal(resolveTheoreticalBalance(null, 81525.36, true), 81525.36);
  assert.equal(resolveTheoreticalBalance(81525.36, 999, true), 81525.36);
  // Sin transacciones se respeta el valor autoritativo (aunque sea cero).
  assert.equal(resolveTheoreticalBalance(0, 999, false), 0);
});

// --- Bug 2: resumen fiscal desde los totales persistidos por factura ---

test("fiscalResumen: suma los totales fiscales persistidos por factura", () => {
  const res = buildFiscalResumen([
    { baseImponibleVes: 100, totalExentoVes: 0, ivaPorcentaje: 16, ivaMontoVes: 16, totalVes: 116 },
    { baseImponibleVes: 50, totalExentoVes: 20, ivaPorcentaje: 8, ivaMontoVes: 4, totalVes: 74 },
    { baseImponibleVes: 200, totalExentoVes: 0, ivaPorcentaje: 16, ivaMontoVes: 32, totalVes: 232 },
  ]);

  assert.equal(res.taxableBase, 350);
  assert.equal(res.exemptTotal, 20);
  assert.deepEqual(res.vatByRate, { 8: 4, 16: 48 });
  assert.equal(res.grandTotal, 422);
});

test("fiscalResumen: lista vacia devuelve todo en cero", () => {
  const res = buildFiscalResumen([]);

  assert.equal(res.taxableBase, 0);
  assert.equal(res.exemptTotal, 0);
  assert.equal(res.grandTotal, 0);
  assert.deepEqual(res.vatByRate, {});
});

test("fiscalResumen: una factura sin datos fiscales aporta cero sin romper la suma", () => {
  const res = buildFiscalResumen([
    { baseImponibleVes: 100, totalExentoVes: 0, ivaPorcentaje: 16, ivaMontoVes: 16, totalVes: 116 },
    {},
    { baseImponibleVes: 0, totalExentoVes: 0, ivaPorcentaje: 0, ivaMontoVes: 0, totalVes: 0 },
  ]);

  assert.equal(res.taxableBase, 100);
  assert.equal(res.exemptTotal, 0);
  assert.equal(res.grandTotal, 116);
  assert.deepEqual(res.vatByRate, { 16: 16 });
});
