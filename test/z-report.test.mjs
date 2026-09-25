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

// --- Reporte X (No Fiscal) sobre la POS80 ---

const { buildSessionSummary } = await import("../modules/cash-register/lib/z-report.ts");
const { runXReportFallback } = await import("../modules/cash-register/lib/fiscal-fallback-flow.ts");
const { renderNoFiscalTicket } = await import("../modules/cash-register/lib/pos58-print.ts");

test("buildSessionSummary: cobros, devoluciones y neto desde la sesion", () => {
  const s = buildSessionSummary({
    sessionInvoices: [{ totalVes: 20451.75 }],
    sessionTransactions: [
      { type: "sale", paymentMethod: "efectivo", amountVes: 12009.38 },
      { type: "sale", paymentMethod: "mobile", amountVes: 2646.76 },
      { type: "sale", paymentMethod: "card", amountVes: 5795.61 },
      { type: "devolucion", paymentMethod: "card", amountVes: 5795.61 },
      { type: "otro", paymentMethod: "card", amountVes: 999 },
    ],
  });
  assert.deepEqual(s.paymentBreakdown, [
    { label: "Efectivo Bs", amount: 12009.38 },
    { label: "Pago Movil", amount: 2646.76 },
    { label: "Tarjeta", amount: 5795.61 },
  ]);
  assert.deepEqual(s.deviationsByMethod, [{ label: "Tarjeta", amount: 5795.61 }]);
  assert.equal(s.summary.grossTotal, 20451.75);
  assert.equal(s.summary.netTotal, 14656.14);
  assert.equal(s.summary.ok, true);
});

test("runXReportFallback: imprime REPORTE X NO FISCAL con neto y cuadre, sin persistir", async () => {
  let printedTicket = null;
  const outcome = await runXReportFallback({
    header: { name: "Farmacia Test", rif: "J-123" },
    pharmacyId: "ph-1",
    sessionInvoices: [
      { controlNumber: "NF-1", totalVes: 100, lines: [{ subtotalVes: 100, vatPercentage: 16 }] },
      { controlNumber: "NF-2", totalVes: 50, lines: [{ subtotalVes: 50, vatPercentage: 0 }] },
    ],
    paymentBreakdown: [{ label: "Efectivo Bs", amount: 150 }],
    deviations: [],
    reconciliation: [
      { label: "Cuadre ventas", amount: 0 },
      { label: "Cuadre neto", amount: 0 },
    ],
    netTotal: 150,
    rate: 36.5,
    print: async (ticket) => {
      printedTicket = ticket;
      return { printed: true, via: "usb" };
    },
  });

  assert.equal(outcome.printed, true);
  assert.equal(printedTicket.kind, "report");
  assert.equal(printedTicket.title, "REPORTE X NO FISCAL");
  assert.equal(printedTicket.total, 150);
  assert.ok(!printedTicket.fields.some((f) => f.label === "Nro Z"), "el X no lleva Nro Z");
  assert.ok(printedTicket.fields.some((f) => f.label === "Tasa USD"), "el X lleva la tasa");

  const text = Buffer.from(renderNoFiscalTicket(printedTicket)).toString("latin1");
  assert.ok(text.includes("REPORTE X NO FISCAL"), "el ticket dice REPORTE X NO FISCAL");
  assert.ok(!text.includes("REPORTE Z"), "no debe salir como Z");
  assert.ok(text.includes("TOTAL Bs 150,00"), "imprime el neto");
  assert.ok(text.includes("Cuadre:"), "imprime el cuadre");
});
