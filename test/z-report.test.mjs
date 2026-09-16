import test from "node:test";
import assert from "node:assert/strict";
import { buildZSummary } from "../modules/cash-register/lib/z-report.ts";
import { buildReportTicket } from "../modules/cash-register/lib/pos58-ticket.ts";

test("Z cuadra: ventas por método == facturado y neto == bruto − devoluciones", () => {
  const z = buildZSummary({
    invoicedTotalVes: 20451.75,
    salesByMethod: [
      { label: "Efectivo Bs", amount: 12009.38 },
      { label: "Pago Movil", amount: 2646.76 },
      { label: "Tarjeta", amount: 5795.61 },
    ],
    deviationsByMethod: [{ label: "Tarjeta", amount: 5795.61 }],
  });

  assert.equal(z.grossTotal, 20451.75);
  assert.equal(z.totalDeviations, 5795.61);
  assert.equal(z.netTotal, 14656.14);
  assert.equal(z.salesDiff, 0);
  assert.equal(z.netDiff, 0);
  assert.equal(z.ok, true);
  // Neto por método: la devolución en Tarjeta la deja en 0 y no se lista.
  assert.deepEqual(z.payments, [
    { label: "Efectivo Bs", amount: 12009.38 },
    { label: "Pago Movil", amount: 2646.76 },
  ]);
});

test("Z descuadrado: faltan transacciones de venta → no cuadra", () => {
  const z = buildZSummary({
    invoicedTotalVes: 20451.75,
    salesByMethod: [
      { label: "Efectivo Bs", amount: 12009.38 },
      { label: "Pago Movil", amount: 2646.76 },
    ],
  });

  assert.equal(z.netTotal, 20451.75);
  assert.equal(z.salesDiff, -5795.61);
  assert.equal(z.netDiff, -5795.61);
  assert.equal(z.ok, false);
});

test("Z sin facturas no cuadra si hay cobros (y viceversa)", () => {
  const z = buildZSummary({
    invoicedTotalVes: 0,
    salesByMethod: [{ label: "Efectivo Bs", amount: 100 }],
  });
  assert.equal(z.ok, false);
  assert.equal(z.salesDiff, 100);
});

test("buildReportTicket: imprime devoluciones, neto, metodos y cuadre", () => {
  const bytes = buildReportTicket({
    header: { name: "Farmacia Test", rif: "J-123" },
    title: "REPORTE Z NO FISCAL",
    date: "16/09/2026 12:34",
    fields: [],
    totals: [
      { label: "Ventas base", amount: 100 },
      { label: "IVA", amount: 16 },
    ],
    deviations: [{ label: "Efectivo Bs", amount: 10 }],
    paymentBreakdown: [{ label: "Efectivo Bs", amount: 106 }],
    total: 106,
    reconciliation: [
      { label: "Cuadre ventas", amount: 0 },
      { label: "Cuadre neto", amount: 0 },
    ],
    legend: "NO FISCAL",
  });
  const text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.includes("Devoluciones (NC):"), "debe imprimir devoluciones");
  assert.ok(text.includes("TOTAL Bs 106,00"), "debe imprimir el total neto");
  assert.ok(text.includes("Por metodo de pago (neto):"));
  assert.ok(text.includes("Cuadre:"));
  assert.ok(text.includes("Cuadre ventas"));
});
