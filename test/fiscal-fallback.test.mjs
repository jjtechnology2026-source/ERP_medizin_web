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
import { renderNoFiscalTicket } from "../modules/cash-register/lib/pos58-print.ts";
import {
  runOrderFallback,
  runZReportFallback,
  runNoteFallback,
} from "../modules/cash-register/lib/fiscal-fallback-flow.ts";
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

test("pos58: la factura renderiza cabecera (farmacia+RIF) y la leyenda NO FISCAL", () => {
  const bytes = renderNoFiscalTicket({
    kind: "sale",
    header: { name: "FARMACIA DEMO", rif: "J-12345678-9" },
    title: "COMPROBANTE NO FISCAL",
    controlNumber: "NF000000000001",
    date: "10/09/2026 10:00",
    customerName: "Cliente General",
    customerDoc: "V-00000000",
    items: [{ qty: 1, description: "Producto", amount: 1.5 }],
    totals: [],
    total: 1.5,
    payments: [{ label: "Efectivo Bs", amount: 1.5 }],
    legend: "NO FISCAL",
  });
  const text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.includes("FARMACIA DEMO"));
  assert.ok(text.includes("J-12345678-9"));
  assert.ok(text.includes("NO FISCAL"));
});

// --- C2: order persistence via submitOrder on the fallback path ---

test("runOrderFallback: reintenta submitOrder con los identificadores sintetizados si fallo el transporte", async () => {
  const submitCalls = [];
  const printDocs = [];
  const outcome = await runOrderFallback({
    header: { name: "FARMACIA", rif: "J-1" },
    order: { rate: RATE, medications: [{ quantity: 1, price: 5 }] },
    initialResult: null,
    transportFailed: true,
    saleType: "digital",
    sessionId: "s1",
    submitOrder: async (order, saleType, sessionId) => {
      submitCalls.push({ order, saleType, sessionId });
      return { facturacion: "stored", ordenId: "o9" };
    },
    print: async (doc) => { printDocs.push(doc); return { printed: true, via: "usb" }; },
  });
  assert.equal(submitCalls.length, 1);
  assert.equal(submitCalls[0].saleType, "digital");
  assert.equal(submitCalls[0].sessionId, "s1");
  assert.equal(typeof submitCalls[0].order.numeroControlInterno, "string");
  assert.equal(submitCalls[0].order.facturacion.fallback, true);
  assert.equal(submitCalls[0].order.facturacion.numeroControl, submitCalls[0].order.numeroControlInterno);
  assert.equal(outcome.ordenId, "o9");
  assert.equal(outcome.fiscalFallback, true);
  assert.equal(printDocs.length, 1);
  assert.equal(printDocs[0].kind, "sale");
  assert.equal(printDocs[0].header.name, "FARMACIA");
  assert.equal(printDocs[0].header.rif, "J-1");
  assert.equal(printDocs[0].title, "COMPROBANTE NO FISCAL");
});

test("runOrderFallback: no reintenta si el fallo no fue de transporte y conserva el ordenId inicial", async () => {
  let submits = 0;
  const outcome = await runOrderFallback({
    header: { name: "F", rif: "J-1" },
    order: { medications: [{ quantity: 1, price: 2 }] },
    initialResult: { ordenId: "o-init" },
    transportFailed: false,
    saleType: "digital",
    sessionId: "s1",
    submitOrder: async () => { submits += 1; return { ordenId: "should-not-run" }; },
    print: async () => ({ printed: true, via: "usb" }),
  });
  assert.equal(submits, 0);
  assert.equal(outcome.ordenId, "o-init");
  assert.equal(outcome.fiscalFallback, true);
});

test("runOrderFallback: expone printError cuando la POS58 no imprime", async () => {
  const outcome = await runOrderFallback({
    header: { name: "F", rif: "J-1" },
    order: { medications: [{ quantity: 1, price: 2 }] },
    initialResult: { ordenId: "o-init" },
    transportFailed: false,
    saleType: "digital",
    sessionId: "s1",
    submitOrder: async () => ({ ordenId: "nope" }),
    print: async () => ({ printed: false, via: "usb", error: "sin gesto de usuario" }),
  });
  assert.equal(outcome.printError, "sin gesto de usuario");
});

// --- C3: Z persistence retry via createZReport on the fallback path ---

test("runZReportFallback: reintenta createZReport con el Z sintetizado y registra el marcador persistido", async () => {
  const calls = [];
  const recorded = [];
  const outcome = await runZReportFallback({
    header: { name: "F", rif: "J-1" },
    pharmacyId: "PH1",
    sessionInvoices: [
      { controlNumber: "A-1", totalVes: 100 },
      { controlNumber: "A-2", totalVes: 50 },
    ],
    initialResult: { success: false, report: null },
    createZReport: async (pharmacyId, payload) => {
      calls.push({ pharmacyId, payload });
      return { success: true, report: { fiscalDate: "2026-09-10", zNumber: 999 } };
    },
    print: async () => ({ printed: true, via: "browser" }),
    record: (marker) => { recorded.push(marker); },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pharmacyId, "PH1");
  assert.equal(typeof calls[0].payload.z_number, "number");
  assert.match(calls[0].payload.fiscal_serial, /^PH1-\d{4}-\d{2}-\d{2}-\d+$/);
  assert.match(calls[0].payload.fiscal_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(calls[0].payload.invoices, { count: 2, doc_from: "A-1", doc_to: "A-2" });
  assert.equal(outcome.report.zNumber, 999);
  assert.equal(outcome.fallback.fallback, true);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].zNumber, 999);
  assert.equal(recorded[0].fiscalDate, "2026-09-10");
});

test("runZReportFallback: si el reintento falla, registra el marcador con los valores sintetizados", async () => {
  const recorded = [];
  const outcome = await runZReportFallback({
    header: { name: "F", rif: "J-1" },
    pharmacyId: "PH1",
    sessionInvoices: [],
    initialResult: { success: false, report: null },
    createZReport: async () => { throw new Error("transporte caido"); },
    print: async () => ({ printed: true, via: "jspdf" }),
    record: (marker) => { recorded.push(marker); },
  });
  assert.equal(outcome.report, null);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].pharmacyId, "PH1");
  assert.equal(recorded[0].zNumber, outcome.fallback.z_number);
  assert.equal(recorded[0].fiscalDate, outcome.fallback.fiscal_date);
});

// --- C4: note persistence retry on the fallback path ---

test("runNoteFallback: reintenta createNotaCredito con tracking y control sintetizados", async () => {
  const calls = [];
  const note = await runNoteFallback({
    header: { name: "F", rif: "J-1" },
    payload: {
      id_pharmacy: "PH1",
      tracking_id: "original",
      numero_control_interno: "INT-1",
    },
    createNote: async (payload) => { calls.push(payload); return { success: true }; },
    print: async () => ({ printed: true, via: "browser" }),
    affectedDocument: "F-1",
    total: 12.5,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id_pharmacy, "PH1");
  assert.equal(calls[0].tracking_id, note.tracking_id);
  assert.equal(calls[0].numero_control_interno, note.numero_control);
  assert.equal(note.url_pdf, null);
  assert.equal(note.fiscal_success, false);
});

test("runNoteFallback: cubre el reintento TFHKA y no propaga un reintento fallido", async () => {
  let attempts = 0;
  const note = await runNoteFallback({
    header: { name: "F", rif: "J-1" },
    payload: { id_pharmacy: "PH1", factura_id: "F-1" },
    createNote: async () => { attempts += 1; throw new Error("tfhka caido"); },
    print: async () => ({ printed: true, via: "jspdf" }),
    affectedDocument: "F-1",
    total: 3,
  });
  assert.equal(attempts, 1);
  assert.equal(note.fiscal_error, FALLBACK_NOTE_ERROR);
  assert.equal(typeof note.numero_control, "string");
});
