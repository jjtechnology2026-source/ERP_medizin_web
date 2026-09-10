import test from "node:test";
import assert from "node:assert/strict";
import {
  NO_FISCAL_LEGEND,
  FALLBACK_NOTE_ERROR,
  isFiscalFailure,
  synthesizeFiscalNumber,
  synthesizeTrackingId,
  buildFallbackInvoice,
  applyFallbackInvoiceToOrder,
  buildFallbackZReport,
  buildFallbackNote,
  recordFallbackZ,
  isFallbackZ,
} from "../modules/cash-register/lib/fiscal-fallback.ts";
import { fiscalItemsTotal, toBs2 } from "../modules/cash-register/lib/money.ts";
import {
  buildFiscalPayload,
  computeFiscalItemsExpectedTotal,
} from "../modules/cash-register/lib/fiscal-payload.ts";

const RATE = 771.0714;

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
  };
}

test("isFiscalFailure: error de transporte (null/undefined) es fallo", () => {
  assert.equal(isFiscalFailure(null), true);
  assert.equal(isFiscalFailure(undefined), true);
});

test("isFiscalFailure: success=false o error presente es fallo", () => {
  assert.equal(isFiscalFailure({ success: false }), true);
  assert.equal(isFiscalFailure({ success: true, error: "boom" }), true);
});

test("isFiscalFailure: numeroControl null/ausente es fallo", () => {
  assert.equal(isFiscalFailure({ success: true, numeroControl: null }), true);
  assert.equal(isFiscalFailure({ success: true }), true);
});

test("isFiscalFailure: exito completo no es fallo (canal local intacto)", () => {
  assert.equal(isFiscalFailure({ success: true, numeroControl: "001" }), false);
});

test("synthesize: fiscal number respeta prefijo y tracking id no vacio", () => {
  assert.ok(synthesizeFiscalNumber("NF").startsWith("NF"));
  assert.ok(synthesizeFiscalNumber().length > 0);
  assert.ok(synthesizeTrackingId().length > 0);
});

test("buildFallbackInvoice: urlpdf null y total = fiscalItemsTotal", () => {
  const order = {
    rate: RATE,
    medications: [
      { quantity: 1, price: 10.44 },
      { quantity: 3, price: 3.33 },
    ],
  };
  const invoice = buildFallbackInvoice(order);
  assert.equal(invoice.urlpdf, null);
  const items = order.medications.map((m) => ({
    quantity: m.quantity,
    unit_price: toBs2(m.price * (order.rate || 1)),
  }));
  assert.equal(invoice.total, fiscalItemsTotal(items));
});

test("invariante monetario: misma convencion que buildFiscalPayload", () => {
  const meds = [
    { name: "A", price: 10.44, quantity: 1, vat: 16 },
    { name: "B", price: 3.33, quantity: 3, vat: 8 },
    { name: "C", price: 7.89, quantity: 1.5, vat: 16 },
  ];
  const order = { rate: RATE, medications: meds };
  const invoice = buildFallbackInvoice(order);
  const payload = buildFiscalPayload({ ...order, payments: [], totalreal: 0 });
  assert.equal(invoice.total, computeFiscalItemsExpectedTotal(payload.items));
});

test("buildFallbackZReport: deriva rango y total de sessionInvoices", () => {
  const z = buildFallbackZReport({
    sessionInvoices: [
      { controlNumber: "A-1", totalVes: 100.5 },
      { controlNumber: "A-2", totalVes: 50.25 },
    ],
    pharmacyId: "PH1",
  });
  assert.equal(z.invoices.count, 2);
  assert.equal(z.invoices.doc_from, "A-1");
  assert.equal(z.invoices.doc_to, "A-2");
  assert.equal(z.total_sales, 150.75);
  assert.equal(z.fallback, true);
  assert.equal(z.credit_notes, null);
  assert.equal(z.debit_notes, null);
});

test("buildFallbackZReport: sin sessionInvoices igual queda poblado", () => {
  const now = new Date("2026-09-10T15:30:45.000Z");
  const z = buildFallbackZReport({ now, pharmacyId: "PH1" });
  assert.equal(typeof z.z_number, "number");
  assert.ok(z.fiscal_serial.length > 0);
  assert.equal(z.fiscal_date, "2026-09-10");
  assert.equal(z.invoices, null);
  assert.equal(z.total_sales, 0);
  assert.equal(z.fallback, true);
});

test("buildFallbackNote: banderas y error de fallback", () => {
  const note = buildFallbackNote();
  assert.equal(note.url_pdf, null);
  assert.equal(note.fiscal_success, false);
  assert.equal(note.fiscal_error, FALLBACK_NOTE_ERROR);
});

test("applyFallbackInvoiceToOrder: setea numeroControlInterno + facturacion.fallback", () => {
  const invoice = buildFallbackInvoice({
    rate: RATE,
    medications: [{ quantity: 1, price: 5 }],
  });
  const order = applyFallbackInvoiceToOrder({ id: "o1" }, invoice);
  assert.equal(order.numeroControlInterno, invoice.numeroControl);
  assert.equal(order.facturacion.fallback, true);
  assert.equal(order.facturacion.numeroControl, invoice.numeroControl);
  assert.equal(order.id, "o1");
});

test("registry: recordFallbackZ / isFallbackZ round-trip en storage inyectado", () => {
  const storage = fakeStorage();
  const marker = { pharmacyId: "PH1", fiscalDate: "2026-09-10", zNumber: 153045 };
  assert.equal(isFallbackZ(marker, storage), false);
  recordFallbackZ(marker, storage);
  assert.equal(isFallbackZ(marker, storage), true);
  assert.equal(
    isFallbackZ({ ...marker, zNumber: 1 }, storage),
    false,
  );
  recordFallbackZ(marker, storage);
  assert.equal(
    JSON.parse(storage.getItem("no-fiscal-z-reports")).length,
    1,
  );
});

test("on-screen outcome: leyenda literal 'No Fiscal'", () => {
  assert.equal(NO_FISCAL_LEGEND, "No Fiscal");
});
