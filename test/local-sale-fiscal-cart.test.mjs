/**
 * El comprobante fiscal queda atado al carrito que lo emitio (nivel de store).
 *
 * Regresiones que cubre, todas reproducidas en produccion:
 *  - B con cliente generico (documento vacio): el bloqueo no disparaba porque la
 *    firma se guardaba sobre la orden-modelo (`V-00000000`) y se consultaba
 *    sobre el carrito crudo (`""`). Fallo -> presupuesto -> hidratar -> vender
 *    terminaba en DOS comprobantes fiscales para una sola venta.
 *  - Volver a cobrar el mismo carrito emitia un segundo COO en vez de reusar el
 *    que ya estaba impreso.
 *  - Un solo slot de comprobante hacia que registrar otra venta borrara el de un
 *    carrito que todavia no se habia registrado.
 *
 * Run: npm run test:local-sale-cart
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  resetCashierServiceMock,
  cashierAccountantService,
} from "./fixtures/cashier-service-mock.mjs";
import fiscalPrinterClient from "../modules/cash-register/api/fiscal-printer-client.ts";
import { useAuthStore } from "../modules/auth/store/useAuthStore.ts";
import { useCurrentOrderStore } from "../modules/cash-register/store/current-order.store.ts";
import { useCurrencyStore } from "../modules/core/store/currency.store.ts";
import { useCashierWorkflowStore } from "../modules/cash-register/store/cashier-workflow.store.ts";

const SESSION = {
  id: "ses-1",
  cashBoxId: "caja-1",
  cashBoxName: "Caja 1",
  approvalStatus: "approved",
};

const invoice = { calls: [] };
// Facturas que el backend ya escribio (run_facturacion desacoplado).
const book = [];
const orderSteps = [];
const quoteCalls = [];
const noteCalls = [];
const submitControls = [];

const original = {
  createInvoice: fiscalPrinterClient.createInvoice,
  submitOrder: cashierAccountantService.submitOrder,
  submitQuote: cashierAccountantService.submitQuote,
  submitDeliveryNote: cashierAccountantService.submitDeliveryNote,
  fetchSessionInvoices: cashierAccountantService.fetchSessionInvoices,
};

function makeCart(id, { code = "P1", price = 10 } = {}) {
  return {
    id,
    date: new Date().toISOString(),
    nameGroup: "",
    idAgent: "",
    nameAgent: "",
    idPharmacy: "",
    idGroup: "",
    medications: [{ barCode: code, name: `MED ${code}`, price, quantity: 1, vat: 0, stock: 10 }],
    totalreal: price,
    totalsystem: price,
    rifEmisor: "",
    // Carrito recien creado: sin cliente, igual que createEmptyOrder().
    client: { id: "", documento: "", name: "", email: "", direccion: "", phone: "", tipo_documento: "" },
    payments: [],
    rate: 1,
    gender: "Male",
    saleStatus: "Pending",
    isControlled: false,
    saleType: "local",
  };
}

function setCart(cart) {
  useCurrentOrderStore.setState({
    orders: [cart],
    currentOrderIndex: 0,
    activePaymentMethods: ["efectivo"],
    payments: { efectivo: { type: "efectivo", amount: 10, currency: "VES" } },
  });
}

const store = () => useCashierWorkflowStore.getState();

beforeEach(() => {
  invoice.calls = [];
  orderSteps.length = 0;
  quoteCalls.length = 0;
  noteCalls.length = 0;
  submitControls.length = 0;

  resetCashierServiceMock({
    assignedCajaId: "caja-1",
    openSessions: [SESSION],
    cashBoxes: [{ id: "caja-1", name: "Caja 1" }],
  });

  book.length = 0;
  cashierAccountantService.fetchSessionInvoices = async () => book;

  useCurrencyStore.setState({ rate: 1, manualRate: 0, rateSource: "api" });
  useAuthStore.setState({
    profile: {
      id: "agent-1",
      name: "Ana",
      role: "agent",
      permits: [],
      pharmacyId: "PH-1",
      pharmacyName: "Farmacia X",
      rif: "J-1",
      cajaId: "caja-1",
    },
  });
  useCashierWorkflowStore.setState({
    activeSession: SESSION,
    fiscalAvailable: true,
    fiscalIssued: {},
    errorMessage: null,
    infoMessage: null,
    isSubmitting: false,
    lastQuoteNumber: null,
  });

  fiscalPrinterClient.createInvoice = async (payload) => {
    invoice.calls.push(payload);
    const total = (payload?.items ?? []).reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
      0,
    );
    return {
      fiscal_number: `COO-${invoice.calls.length}`,
      fiscal_serial: "HKA1",
      total,
    };
  };

  cashierAccountantService.submitOrder = async (order) => {
    submitControls.push(order?.numeroControlInterno ?? null);
    const step = orderSteps.length ? orderSteps.shift() : { ordenId: "orden-ok" };
    if (step instanceof Error) throw step;
    return {
      ordenId: "orden-ok",
      facturacion: {
        success: true,
        numeroControl: order?.numeroControlInterno ?? null,
        urlPdf: null,
        error: null,
      },
    };
  };

  cashierAccountantService.submitQuote = async () => {
    quoteCalls.push(1);
    return { quoteNumber: "COT-1", ordenId: "cot-1" };
  };

  cashierAccountantService.submitDeliveryNote = async () => {
    noteCalls.push(1);
    return { quoteNumber: "NE-1", ordenId: "ne-1" };
  };
});

test.after(() => {
  fiscalPrinterClient.createInvoice = original.createInvoice;
  cashierAccountantService.submitOrder = original.submitOrder;
  cashierAccountantService.submitQuote = original.submitQuote;
  cashierAccountantService.submitDeliveryNote = original.submitDeliveryNote;
  cashierAccountantService.fetchSessionInvoices = original.fetchSessionInvoices;
});

test("con el cliente generico el COO emitido bloquea presupuesto y nota de entrega", async () => {
  setCart(makeCart("ORD-P1"));
  orderSteps.push(new Error("502 backend"));

  assert.equal(await store().registerSale("local"), null, "la venta no se registra");
  assert.equal(invoice.calls.length, 1, "una sola emision fiscal");
  assert.match(store().errorMessage, /COO-1/, "el error nombra el comprobante emitido");

  assert.equal(await store().saveQuote(), null, "no se guarda el presupuesto");
  assert.equal(quoteCalls.length, 0, "no se llama submitQuote");

  assert.equal(await store().saveDeliveryNote(), null, "no se guarda la nota de entrega");
  assert.equal(noteCalls.length, 0, "no se llama submitDeliveryNote");
});

test("re-cobrar el mismo carrito reusa el COO: un solo comprobante por venta", async () => {
  setCart(makeCart("ORD-P1"));
  // Una sola escritura por intento: la orden no tiene clave de idempotencia.
  orderSteps.push(new Error("502 backend"));

  assert.equal(await store().registerSale("local"), null);

  const replay = await store().registerSale("local");
  assert.notEqual(replay, null, "el reintento registra la venta");
  assert.equal(invoice.calls.length, 1, "NO se emite un segundo comprobante");
  assert.equal(replay.facturacion.numeroControl, "COO-1", "se reusa el COO impreso");
  assert.deepEqual(
    submitControls,
    ["COO-1", "COO-1"],
    "todas las escrituras llevan el mismo COO",
  );
});

test("registrar otra venta no borra el comprobante pendiente de un carrito", async () => {
  const cartA = makeCart("ORD-A");
  setCart(cartA);
  orderSteps.push(new Error("502"));
  assert.equal(await store().registerSale("local"), null);
  assert.equal(invoice.calls.length, 1);

  const cartB = makeCart("ORD-B", { code: "P2", price: 20 });
  setCart(cartB);
  assert.notEqual(await store().registerSale("local"), null, "la otra venta se registra");
  assert.equal(invoice.calls.length, 2);

  // Volver al carrito A: su comprobante sigue pendiente y NO se emite otro.
  useCurrentOrderStore.setState({ orders: [cartA, cartB], currentOrderIndex: 0 });
  assert.equal(await store().saveQuote(), null, "el carrito A sigue bloqueado");
  const back = await store().registerSale("local");
  assert.notEqual(back, null);
  assert.equal(invoice.calls.length, 2, "el tercer COO no debe existir");
  assert.equal(back.facturacion.numeroControl, "COO-1");
});

test("el comprobante no bloquea a un carrito distinto ni a uno sin comprobante", async () => {
  const cartA = makeCart("ORD-A");
  setCart(cartA);
  orderSteps.push(new Error("502"));
  assert.equal(await store().registerSale("local"), null);

  const cartB = makeCart("ORD-B", { code: "P2", price: 20 });
  setCart(cartB);
  assert.ok(await store().saveQuote(), "otro carrito no hereda el bloqueo");
  assert.equal(quoteCalls.length, 1);

  useCurrentOrderStore.setState({ orders: [cartA, cartB], currentOrderIndex: 0 });
  assert.equal(await store().saveQuote(), null, "el carrito que emitio sigue bloqueado");
  assert.equal(quoteCalls.length, 1);

  setCart(makeCart("ORD-C"));
  assert.ok(await store().saveQuote(), "sin comprobante emitido no hay bloqueo");
  assert.ok(await store().saveDeliveryNote(), "ni bloqueo de nota de entrega");
});

test("re-cobrar con la factura ya en el libro no reenvia: reconoce el COO", async () => {
  setCart(makeCart("ORD-P1"));
  orderSteps.push(new Error("502 backend"));
  assert.equal(await store().registerSale("local"), null);
  assert.equal(invoice.calls.length, 1);
  assert.match(store().errorMessage, /COO-1/);
  assert.doesNotMatch(store().errorMessage, /exitosamente|se registró/i);

  // El run_facturacion desacoplado ya escribio la factura.
  book.push({ controlNumber: "COO-1" });

  const replay = await store().registerSale("local");
  assert.notEqual(replay, null, "el re-cobro manual registra la venta");
  assert.equal(invoice.calls.length, 1, "NO se pide un segundo COO");
  assert.deepEqual(submitControls, ["COO-1"], "la reconciliacion no reenvia la orden");
  assert.equal(replay.facturacion.numeroControl, "COO-1");
  assert.deepEqual(store().fiscalIssued, {});
});

test("re-cobro manual con el libro caido: ni reescribe ni miente", async () => {
  setCart(makeCart("ORD-P1"));
  orderSteps.push(new Error("502 backend"));
  assert.equal(await store().registerSale("local"), null);

  cashierAccountantService.fetchSessionInvoices = async () => {
    throw new Error("libro caido");
  };

  assert.equal(await store().registerSale("local"), null);
  assert.deepEqual(submitControls, ["COO-1"], "sin lectura no hay segunda escritura");
  assert.match(store().errorMessage, /no se pudo confirmar/);
  assert.match(store().errorMessage, /COO-1/);
});

test("con COO impreso, fiscalAvailable=false no cae a No Fiscal", async () => {
  setCart(makeCart("ORD-P1"));
  orderSteps.push(new Error("502 backend"));
  assert.equal(await store().registerSale("local"), null);
  useCashierWorkflowStore.setState({ fiscalAvailable: false, errorMessage: null });

  const replay = await store().registerSale("local");
  assert.notEqual(replay, null);
  assert.equal(invoice.calls.length, 1, "no se emite otro COO");
  assert.deepEqual(submitControls, ["COO-1", "COO-1"], "ninguna escritura lleva control inventado");
  assert.doesNotMatch(String(replay.facturacion.numeroControl), /FALLO|NF-/);
});
