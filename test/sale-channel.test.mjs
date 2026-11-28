/**
 * La venta obedece al canal DETECTADO, sin fallback
 * (`odd/tasks/canal-comprobante-por-caja.md`, Specs S1-S4).
 *
 *   servicio fiscal responde  -> canal = fiscal  (y si falla, es error: S3)
 *   servicio fiscal ausente   -> canal = pos80   (y si no imprime, no hay venta: S4)
 *
 * Los tests de `channel-detect.test.mjs` fijan la DECISION; estos fijan lo que
 * el store hace con ella, a nivel de `registerSale`:
 *  - el canal POS80 imprime antes de enviar, envia una sola vez, y sin papel no
 *    envia nada (el carrito queda intacto para reintentar);
 *  - con el servicio vivo, cualquier fallo de la maquina fiscal es error con
 *    motivo y la POS80 no se toca: cambiar de canal por un fallo de la impresora
 *    es el fallback que esta rama elimino.
 *
 * Corre con el store REAL y el fixture del servicio de caja; solo se doblan las
 * tres dependencias externas: servicio fiscal (HTTP local), backend
 * (`submitOrder`) y el transporte WebUSB de la POS80.
 *
 * Run: npm run test:sale-channel
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
/** Escrituras al backend, con el payload que se envio. */
const submits = [];
/** Orden observable de los hechos: "print" y "submit". */
const events = [];

// --- POS80 (WebUSB) minima, solo lo que `pos80-usb.ts` toca -------------------
//
// `printEscPos` devuelve `printed:false` cuando no hay `navigator.usb`
// (`pos80-usb.ts:271-275`), asi que los casos en que el papel SI sale necesitan
// un dispositivo. Se dobla `navigator.usb` en vez de usar `__setPrinterSeams`
// porque ese seam solo ajusta el timeout de transferencia: no permite ni
// emparejar ni simular un papel que no sale. Con este doble corre el camino real
// entero (`isPrinterPaired` -> `connect` -> `write`), y las transferencias
// quedan contadas: `transfers === 0` prueba que el canal POS80 no se toco.
const PRINTER_CLASS = 7;

const printerConfig = {
  interfaces: [
    {
      interfaceNumber: 0,
      alternate: {
        // `isPrinter` reconoce la POS80 por la clase de la interfaz.
        interfaceClass: PRINTER_CLASS,
        endpoints: [{ endpointNumber: 1, direction: "out", type: "bulk" }],
      },
    },
  ],
};

const usbState = {
  /** true = la POS80 figura emparejada (`getDevices` devuelve el dispositivo). */
  paired: false,
  /** true = el papel no sale: `transferOut` rechaza. */
  printFails: false,
  printError: "sin papel",
  /** Transferencias de bytes: cero significa que la POS80 no imprimio. */
  transfers: 0,
  /** Aperturas del selector WebUSB: en una venta no debe haber ninguna. */
  requests: 0,
};

const printerDevice = {
  opened: false,
  configuration: null,
  configurations: [printerConfig],
  async open() {
    this.opened = true;
  },
  async selectConfiguration() {
    this.configuration = printerConfig;
  },
  async claimInterface() {},
  async close() {
    this.opened = false;
    this.configuration = null;
  },
  async transferOut(_endpoint, chunk) {
    if (usbState.printFails) throw new Error(usbState.printError);
    // El primer byte escrito ES el papel saliendo: se registra antes de que el
    // store llame a submitOrder, que es lo que el caso 1 verifica.
    if (usbState.transfers === 0) events.push("print");
    usbState.transfers += 1;
    return { status: "ok", bytesWritten: chunk.length };
  },
};

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  writable: true,
  value: {
    usb: {
      async getDevices() {
        return usbState.paired ? [printerDevice] : [];
      },
      async requestDevice() {
        usbState.requests += 1;
        throw new Error("la venta no abre el selector WebUSB");
      },
    },
  },
});

const original = {
  createInvoice: fiscalPrinterClient.createInvoice,
  getHealth: fiscalPrinterClient.getHealth,
  getPrinterStatus: fiscalPrinterClient.getPrinterStatus,
  submitOrder: cashierAccountantService.submitOrder,
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

/** `GET /health` sin servicio: la terminal esta sola. */
const healthAbsent = async () => {
  throw new Error("connection refused");
};

beforeEach(() => {
  invoice.calls = [];
  submits.length = 0;
  events.length = 0;

  usbState.paired = false;
  usbState.printFails = false;
  usbState.printError = "sin papel";
  usbState.transfers = 0;
  usbState.requests = 0;

  resetCashierServiceMock({
    assignedCajaId: "caja-1",
    openSessions: [SESSION],
    cashBoxes: [{ id: "caja-1", name: "Caja 1" }],
  });

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
    pharmacyId: "PH-1",
    activeSession: SESSION,
    fiscalAvailable: true,
    fiscalIssued: {},
    errorMessage: null,
    infoMessage: null,
    isSubmitting: false,
    lastQuoteNumber: null,
  });

  // Servicio fiscal VIVO por defecto: el canal es fiscal. Los casos de POS80
  // reemplazan `getHealth` por uno que no responde.
  fiscalPrinterClient.getHealth = async () => ({ status: "ok" });
  fiscalPrinterClient.getPrinterStatus = async () => ({ status: "ok" });

  fiscalPrinterClient.createInvoice = async (payload) => {
    invoice.calls.push(payload);
    const total = (payload?.items ?? []).reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
      0,
    );
    return { fiscal_number: `COO-${invoice.calls.length}`, fiscal_serial: "HKA1", total };
  };

  cashierAccountantService.submitOrder = async (order, saleType, sessionId) => {
    events.push("submit");
    submits.push({ order, saleType, sessionId });
    return {
      ordenId: "orden-1",
      facturacion: {
        success: true,
        numeroControl: order?.numeroControlInterno ?? null,
        urlPdf: null,
        error: null,
      },
    };
  };
});

test.after(() => {
  fiscalPrinterClient.createInvoice = original.createInvoice;
  fiscalPrinterClient.getHealth = original.getHealth;
  fiscalPrinterClient.getPrinterStatus = original.getPrinterStatus;
  cashierAccountantService.submitOrder = original.submitOrder;
});

test("servicio ausente + POS80 pareada: imprime el ticket y recién después envía la venta, una sola vez", async () => {
  setCart(makeCart("ORD-POS80-1"));
  usbState.paired = true;
  fiscalPrinterClient.getHealth = healthAbsent;

  const result = await store().registerSale("local");

  assert.notEqual(result, null, "la venta se registra");
  assert.deepEqual(events, ["print", "submit"], "el papel sale antes de escribir en el backend");
  assert.equal(submits.length, 1, "la orden se envía una sola vez");
  assert.equal(invoice.calls.length, 0, "no se pide comprobante a la máquina fiscal");
  assert.ok(usbState.transfers > 0, "la POS80 imprimió el ticket");
  assert.equal(usbState.requests, 0, "no se abre el selector WebUSB durante la venta");
  assert.match(store().infoMessage, /comprobante POS80/i, "el mensaje dice por qué canal salió");
  assert.equal(store().errorMessage, null);
});

test("servicio ausente + POS80 que no imprime: no se envía nada y la venta no se registra (S4)", async () => {
  setCart(makeCart("ORD-POS80-2"));
  usbState.paired = true;
  usbState.printFails = true;
  fiscalPrinterClient.getHealth = healthAbsent;

  const result = await store().registerSale("local");

  assert.equal(result, null, "sin papel no hay venta");
  assert.deepEqual(events, [], "no se envía nada al backend");
  assert.equal(submits.length, 0, "submitOrder no se llamó");
  assert.match(store().errorMessage, /sin papel/, "informa el motivo concreto del print (S6)");
  assert.match(store().errorMessage, /no se registró/, "dice que la venta no se registró");
});

test("servicio ausente + POS80 sin emparejar: no imprime, no envía y lo dice", async () => {
  setCart(makeCart("ORD-POS80-3"));
  usbState.paired = false;
  fiscalPrinterClient.getHealth = healthAbsent;

  const result = await store().registerSale("local");

  assert.equal(result, null);
  assert.equal(submits.length, 0, "submitOrder no se llamó");
  assert.equal(usbState.transfers, 0, "la POS80 no imprimió");
  assert.equal(usbState.requests, 0, "tampoco se pide emparejar a mitad de la venta");
  assert.match(store().errorMessage, /POS80 no está emparejada/i);
});

test("servicio vivo + máquina fiscal muda: error con motivo y la POS80 no se usa (S3)", async () => {
  setCart(makeCart("ORD-FISCAL-1"));
  usbState.paired = true; // aunque la POS80 esté lista, no es un canal de salida
  fiscalPrinterClient.getPrinterStatus = async () => {
    throw new Error("la máquina no responde");
  };

  const result = await store().registerSale("local");

  assert.equal(result, null, "la venta no se registra");
  assert.equal(invoice.calls.length, 0, "no se intenta facturar con la máquina muda");
  assert.equal(usbState.transfers, 0, "la POS80 no imprimió: no hay fallback");
  assert.equal(usbState.requests, 0, "no se abre el selector WebUSB");
  assert.equal(submits.length, 0, "submitOrder no se llamó");
  assert.match(store().errorMessage, /máquina fiscal/i, "el motivo nombra la máquina fiscal");
  assert.match(store().errorMessage, /no responde/i, "y conserva el motivo concreto (S6)");
});

test("servicio vivo + la facturación falla: se informa ese motivo y no se cae a POS80 (S3)", async () => {
  setCart(makeCart("ORD-FISCAL-2"));
  usbState.paired = true;
  fiscalPrinterClient.createInvoice = async () => {
    throw new Error("sin papel");
  };

  const result = await store().registerSale("local");

  assert.equal(result, null);
  assert.equal(invoice.calls.length, 0, "el único intento fiscal fue el que falló");
  assert.equal(usbState.transfers, 0, "no se imprimió por POS80");
  assert.equal(submits.length, 0, "submitOrder no se llamó");
  assert.match(store().errorMessage, /sin papel/, "el mensaje lleva el motivo de la máquina");
  assert.match(store().errorMessage, /no se registró/);
});

test("servicio vivo + facturación sin número de control: error y ninguna escritura", async () => {
  setCart(makeCart("ORD-FISCAL-3"));
  usbState.paired = true;
  fiscalPrinterClient.createInvoice = async () => ({ fiscal_serial: "HKA1" });

  const result = await store().registerSale("local");

  assert.equal(result, null);
  assert.equal(invoice.calls.length, 0);
  assert.equal(usbState.transfers, 0, "no se imprimió por POS80");
  assert.equal(submits.length, 0, "submitOrder no se llamó");
  assert.match(store().errorMessage, /sin número de control/i);
  assert.match(store().errorMessage, /no se registró/);
});

test("preservar: servicio vivo + máquina ok registra la venta y no toca la POS80", async () => {
  setCart(makeCart("ORD-FISCAL-4"));
  usbState.paired = true;

  const result = await store().registerSale("local");

  assert.notEqual(result, null, "la venta se registra");
  assert.equal(result.facturacion.numeroControl, "COO-1", "lleva el COO que emitió la fiscal");
  assert.deepEqual(events, ["submit"], "una sola escritura, sin pasar por la POS80");
  assert.equal(submits.length, 1, "submitOrder se llamó una vez");
  assert.equal(usbState.transfers, 0, "la POS80 no imprimió");
  assert.equal(usbState.requests, 0, "no se abre el selector WebUSB");
  assert.match(store().infoMessage, /Venta procesada/i);
  assert.equal(store().errorMessage, null);
});

test("servicio ausente + POS80 que imprime y backend que rechaza: la venta NO se declara registrada (R6)", async () => {
  setCart(makeCart("ORD-POS80-3"));
  usbState.paired = true;
  fiscalPrinterClient.getHealth = healthAbsent;
  cashierAccountantService.submitOrder = async () => {
    events.push("submit");
    throw new Error("502 backend");
  };

  const result = await store().registerSale("local");

  assert.equal(result, null, "sin registro no hay venta");
  assert.ok(usbState.transfers > 0, "el papel ya salió: no se puede deshacer");
  assert.deepEqual(events, ["print", "submit"], "imprimió y después intentó registrar");
  assert.equal(store().infoMessage, null, "no se anuncia una venta registrada que no existe");
  assert.match(String(store().errorMessage), /no se pudo registrar/i);
  assert.match(String(store().errorMessage), /502/);
  assert.match(String(store().errorMessage), /no vuelvas a imprimir/i);
});
