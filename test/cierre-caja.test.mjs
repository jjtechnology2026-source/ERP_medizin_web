import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCierreBalances,
  buildFiscalResumen,
  buildMethodBreakdown,
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

// --- Desglose por metodo de pago ---

test("desglose: un metodo por encima/debajo de su esperado da la diferencia por metodo", () => {
  const res = buildMethodBreakdown({
    expectedByMethod: { efectivo: 100, dolares: 50, tarjeta: 0, pagomovil: 0, biopago: 0 },
    countedByMethod: { efectivo: 120, dolares: 40, tarjeta: 0, pagomovil: 0, biopago: 0 },
    authoritativeTotal: 150,
  });

  const efectivo = res.rows.find((row) => row.key === "efectivo");
  const dolares = res.rows.find((row) => row.key === "dolares");

  assert.equal(efectivo.expected, 100);
  assert.equal(efectivo.counted, 120);
  assert.equal(efectivo.difference, 20);
  assert.equal(dolares.expected, 50);
  assert.equal(dolares.counted, 40);
  assert.equal(dolares.difference, -10);
});

test("desglose: caso real, la diferencia total se explica por metodo", () => {
  const res = buildMethodBreakdown({
    expectedByMethod: {
      efectivo: 601.34,
      dolares: 0,
      tarjeta: 79609.66,
      pagomovil: 1314.36,
      biopago: 0,
    },
    countedByMethod: {
      efectivo: 600,
      dolares: 0,
      tarjeta: 52949.78,
      pagomovil: 1315,
      biopago: 0,
    },
    authoritativeTotal: 81525.36,
  });

  const byKey = Object.fromEntries(res.rows.map((row) => [row.key, row]));

  assert.equal(byKey.tarjeta.expected, 79609.66);
  assert.equal(byKey.tarjeta.counted, 52949.78);
  assert.equal(byKey.tarjeta.difference, -26659.88);
  assert.equal(byKey.pagomovil.difference, 0.64);
  assert.equal(byKey.efectivo.difference, -1.34);
  assert.equal(
    byKey.tarjeta.difference + byKey.pagomovil.difference + byKey.efectivo.difference,
    -26660.58,
  );
  assert.equal(res.divergence, 0);
});

test("desglose: si el esperado local suma el total fiscal, la divergencia es 0", () => {
  const res = buildMethodBreakdown({
    expectedByMethod: { efectivo: 500, dolares: 0, tarjeta: 1500, pagomovil: 0, biopago: 0 },
    countedByMethod: { efectivo: 500, dolares: 0, tarjeta: 1500, pagomovil: 0, biopago: 0 },
    authoritativeTotal: 2000,
  });

  assert.equal(res.expectedLocalTotal, 2000);
  assert.equal(res.authoritativeTotal, 2000);
  assert.equal(res.divergence, 0);
});

test("desglose: si el esperado local difiere del total fiscal, la divergencia es la brecha", () => {
  const res = buildMethodBreakdown({
    expectedByMethod: { efectivo: 500, dolares: 0, tarjeta: 1500, pagomovil: 0, biopago: 0 },
    countedByMethod: { efectivo: 500, dolares: 0, tarjeta: 1500, pagomovil: 0, biopago: 0 },
    authoritativeTotal: 2010.5,
  });

  assert.equal(res.expectedLocalTotal, 2000);
  assert.equal(res.divergence, 10.5);
});

test("desglose: un metodo sin movimiento ni conteo no aporta fila", () => {
  const res = buildMethodBreakdown({
    expectedByMethod: { efectivo: 100, dolares: 0, tarjeta: 0, pagomovil: 0, biopago: 0 },
    countedByMethod: { efectivo: 100, dolares: 0, tarjeta: 0, pagomovil: 0, biopago: 0 },
    authoritativeTotal: 100,
  });

  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].key, "efectivo");
  assert.ok(!res.rows.some((row) => row.key === "biopago"));
});

test("desglose: un metodo sin movimiento pero con conteo si aporta fila (sobrante)", () => {
  const res = buildMethodBreakdown({
    expectedByMethod: { efectivo: 0, dolares: 0, tarjeta: 0, pagomovil: 0, biopago: 0 },
    countedByMethod: { efectivo: 0, dolares: 0, tarjeta: 0, pagomovil: 0, biopago: 20 },
    authoritativeTotal: 0,
  });

  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].key, "biopago");
  assert.equal(res.rows[0].difference, 20);
});
