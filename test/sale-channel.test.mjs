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
 * Y desde `modo-facturacion-simple.md` (S3, T5) hay un TERCER camino que no
 * obedece al canal: una farmacia en modo `simple` no emite por la maquina fiscal
 * ni por la POS80 ni por facturacion digital. La venta se envia y el comprobante
 * contable lo escribe el backend; sin papel, la deteccion de canal no corre.
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
import { __resetChannelMemory } from "../modules/cash-register/lib/channel-detect.ts";
import { detectBillingModeDrift } from "../modules/cash-register/lib/billing-mode-drift.ts";
import { useAuthStore } from "../modules/auth/store/useAuthStore.ts";
import { useCurrentOrderStore } from "../modules/cash-register/store/current-order.store.ts";
import { useCurrencyStore } from "../modules/core/store/currency.store.ts";
import { useCashierWorkflowStore } from "../modules/cash-register/store/cashier-workflow.store.ts";
import { mapUserData } from "../modules/auth/api/auth.services.ts";

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

/**
 * Lecturas de `/health` durante el caso. Es la prueba de que el modo `simple` no
 * resuelve canal: sin sondeo no hay canal que pueda mandar la venta a POS80.
 */
let healthCalls = 0;

/** `GET /health` sin servicio: la terminal esta sola. */
const healthAbsent = async () => {
  throw new Error("connection refused");
};

beforeEach(() => {
  // La gracia de reinicio es memoria de modulo: sin esto, una lectura buena de
  // un caso deja la gracia abierta y el siguiente caso lee "ausente" como
  // "reiniciando" (ver channel-detect.test.mjs).
  __resetChannelMemory();
  invoice.calls = [];
  submits.length = 0;
  events.length = 0;

  usbState.paired = false;
  usbState.printFails = false;
  usbState.printError = "sin papel";
  usbState.transfers = 0;
  usbState.requests = 0;
  healthCalls = 0;

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
  // reemplazan `getHealth` por uno que no responde. Cada lectura se cuenta: en
  // modo `simple` tiene que quedar en cero.
  fiscalPrinterClient.getHealth = async () => {
    healthCalls += 1;
    return { status: "ok" };
  };
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

test("servicio vivo + máquina muda: el status no decide y sin comprobante no hay POS80 (S3)", async () => {
  // Antes esta prueba exigía que NO se intentara facturar con el status caído.
  // Eso era el defecto: `printer/status` se bloquea con el lock del servicio
  // mientras una factura se imprime, así que un status lento trababa la caja sin
  // motivo. Ahora el status es anticipación y la factura es la que decide; lo que
  // esta prueba sostiene es lo que de verdad importa: sin comprobante, no hay venta
  // y no hay POS80.
  setCart(makeCart("ORD-FISCAL-1"));
  usbState.paired = true; // aunque la POS80 esté lista, no es un canal de salida
  fiscalPrinterClient.getPrinterStatus = async () => {
    throw new Error("la máquina no responde");
  };
  fiscalPrinterClient.createInvoice = async () => {
    throw new Error("sin papel");
  };

  const result = await store().registerSale("local");

  assert.equal(result, null, "la venta no se registra");
  assert.equal(invoice.calls.length, 0, "createInvoice fue reemplazado por el doble que falla");
  assert.equal(usbState.transfers, 0, "la POS80 no imprimió: no hay fallback");
  assert.equal(usbState.requests, 0, "no se abre el selector WebUSB");
  assert.equal(submits.length, 0, "submitOrder no se llamó");
  assert.match(store().errorMessage, /máquina fiscal/i, "el motivo nombra la máquina fiscal");
  assert.match(store().errorMessage, /sin papel/, "y conserva el motivo real de la máquina (S6)");
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

test("(R8) canal POS80: la orden registra por qué canal salió y por qué", async () => {
  setCart(makeCart("ORD-EVID-1"));
  usbState.paired = true;
  fiscalPrinterClient.getHealth = healthAbsent;

  await store().registerSale("local");

  assert.equal(submits.length, 1);
  assert.equal(submits[0].order.canal, "pos80", "la venta dice por dónde salió");
  assert.equal(
    submits[0].order.motivoCanal,
    "servicio_ausente",
    "y por qué: el servicio fiscal no estaba",
  );
});

test("(R8) canal fiscal: la evidencia dice servicio presente", async () => {
  setCart(makeCart("ORD-EVID-2"));

  await store().registerSale("local");

  assert.equal(submits.length, 1);
  assert.equal(submits[0].order.canal, "fiscal");
  assert.equal(submits[0].order.motivoCanal, "servicio_presente");
});

test("puerto ocupado: la máquina no responde el status pero la venta se intenta igual", async () => {
  // `printer/status` toma el mismo lock que la facturación, bloqueante: mientras
  // una factura se imprime, el status se queda esperando. Cortarlo por tiempo y
  // negarse a vender dejaba la caja trabada por una impresión en curso.
  setCart(makeCart("ORD-BUSY-1"));
  usbState.paired = true;
  fiscalPrinterClient.getPrinterStatus = async () => {
    throw new Error("puerto ocupado");
  };

  const result = await store().registerSale("local");

  assert.notEqual(result, null, "la venta se registra: el status no es una condición");
  assert.equal(invoice.calls.length, 1, "se le pidió el comprobante a la máquina");
  assert.equal(submits.length, 1);
  assert.equal(usbState.transfers, 0, "no se imprimió por POS80");
  assert.equal(store().errorMessage, null);
  assert.equal(submits[0].order.canal, "fiscal");
});

test("puerto ocupado al facturar: no imprime, no registra y dice el motivo real", async () => {
  setCart(makeCart("ORD-BUSY-2"));
  usbState.paired = true;
  fiscalPrinterClient.createInvoice = async () => {
    throw new Error("puerto ocupado: hay otra operación fiscal en curso");
  };

  const result = await store().registerSale("local");

  assert.equal(result, null, "sin comprobante no hay venta");
  assert.equal(submits.length, 0, "no se manda nada al backend");
  assert.equal(usbState.transfers, 0, "y NO se cae a la POS80");
  assert.match(String(store().errorMessage), /puerto ocupado/, "el motivo es el de la máquina");
  assert.match(String(store().errorMessage), /no se registró/i);
});

test("facturación digital: sin servicio fiscal y sin POS80, la venta se registra igual", async () => {
  // El comprobante lo emite el backend. No hay papel local que exigir, así que
  // pedir la POS80 emparejada bloqueaba cajas que no tienen impresora.
  useAuthStore.setState({
    profile: { ...useAuthStore.getState().profile, usesDigitalBilling: true },
  });
  fiscalPrinterClient.getHealth = healthAbsent;
  usbState.paired = false;
  // El backend emite el comprobante: success con número de control real.
  cashierAccountantService.submitOrder = async (order, saleType, sessionId) => {
    events.push("submit");
    submits.push({ order, saleType, sessionId });
    return {
      ordenId: "orden-1",
      facturacion: {
        success: true,
        numeroControl: "00001234",
        urlPdf: "https://x/f.pdf",
        error: null,
      },
    };
  };
  setCart(makeCart("ORD-DIG-1"));

  const result = await store().registerSale("digital");

  assert.notEqual(result, null, "la venta digital se registra sin impresora alguna");
  assert.equal(submits.length, 1);
  assert.equal(usbState.transfers, 0, "no se intenta imprimir por POS80");
  assert.doesNotMatch(String(store().errorMessage), /POS80|emparejada/i);
});

test("digital sin respuesta del servidor: no pide emparejar nada y avisa que la orden pudo quedar", async () => {
  useAuthStore.setState({
    profile: { ...useAuthStore.getState().profile, usesDigitalBilling: true },
  });
  // Servicio fiscal AUSENTE y POS80 sin emparejar: es la caja real del reporte.
  fiscalPrinterClient.getHealth = healthAbsent;
  cashierAccountantService.submitOrder = async () => {
    throw new Error("502 backend");
  };
  usbState.paired = false;
  setCart(makeCart("ORD-DIG-2"));

  const result = await store().registerSale("digital");

  assert.equal(result, null, "sin respuesta no hay nada que afirmar");
  assert.equal(usbState.transfers, 0, "y no se fabrica papel por POS80 (R7)");
  assert.doesNotMatch(String(store().errorMessage), /emparejada/i, "no se pide un emparejamiento inútil");
  assert.match(String(store().errorMessage), /pudo haberse registrado/i);
});

test("(R8) digital: la respuesta sin `facturacion` es una venta registrada, no un fallo", async () => {
  // La respuesta NORMAL de una venta trae `facturacion: null` (la fila de factura
  // la escribe un run_facturacion desacoplado) y el servicio la normaliza a
  // { success:false, error:null }. Eso NO es un rechazo: la orden está insertada.
  useAuthStore.setState({
    profile: { ...useAuthStore.getState().profile, usesDigitalBilling: true },
  });
  fiscalPrinterClient.getHealth = healthAbsent;
  usbState.paired = false;
  cashierAccountantService.submitOrder = async (order, saleType, sessionId) => {
    events.push("submit");
    submits.push({ order, saleType, sessionId });
    return {
      ordenId: "01ORDEN-INSERTADA",
      facturacion: { success: false, numeroControl: null, urlPdf: null, error: null },
    };
  };
  setCart(makeCart("ORD-DIG-3"));

  const result = await store().registerSale("digital");

  assert.notEqual(result, null, "la venta se registró: no hay nada que negar");
  assert.equal(store().errorMessage, null, "y no se anuncia un fallo que no ocurrió");
  assert.match(String(store().infoMessage), /procesada/i);
  assert.equal(usbState.transfers, 0);
});

test("digital con rechazo fiscal real: la venta queda registrada y se informa el motivo", async () => {
  useAuthStore.setState({
    profile: { ...useAuthStore.getState().profile, usesDigitalBilling: true },
  });
  cashierAccountantService.submitOrder = async () => ({
    ordenId: "01ORDEN-INSERTADA",
    facturacion: { success: false, numeroControl: null, urlPdf: null, error: "sin timbrado" },
  });
  setCart(makeCart("ORD-DIG-4"));

  const result = await store().registerSale("digital");

  assert.notEqual(result, null, "la orden está insertada: la venta existe");
  assert.match(String(store().errorMessage), /quedó registrada/i);
  assert.match(String(store().errorMessage), /sin timbrado/, "el motivo es el del backend");
  assert.equal(usbState.transfers, 0, "no se fabrica papel por POS80");
});

// --- Modo de facturacion `simple` (odd/tasks/modo-facturacion-simple.md, T5) --
//
// S2: `simple` NO es "no registrar": la orden, la factura, las transacciones y el
// inventario se hacen igual. S3: no pasa por la maquina fiscal, ni por la POS80,
// ni por facturacion digital. El comprobante contable lo escribe el backend, asi
// que en el POS no hay canal que resolver ni papel que sacar.

/** Perfil de una farmacia que emite sin comprobante fiscal. */
function setSimpleProfile() {
  useAuthStore.setState({
    profile: {
      ...useAuthStore.getState().profile,
      usesDigitalBilling: false,
      modoFacturacion: "simple",
    },
  });
}

test("modo de facturación: el perfil lo lleva y, sin el campo, se deriva de usesDigitalBilling", () => {
  // El backend ya manda `modoFacturacion` en `login_agent`: se respeta tal cual.
  const simple = mapUserData({
    agentData: { agentId: "a-1", usesDigitalBilling: false, modoFacturacion: "simple" },
    token: "t",
  });
  assert.equal(simple.modoFacturacion, "simple", "el modo del backend llega al perfil");

  // Sesion vieja (token emitido antes de que el backend mandara el modo): se
  // deriva de `usesDigitalBilling`, que es lo que alimentaba el comportamiento.
  const oldDigital = mapUserData({
    agentData: { agentId: "a-2", usesDigitalBilling: true },
    token: "t",
  });
  assert.equal(oldDigital.modoFacturacion, "digital", "sin el campo, digital sigue siendo digital");

  const oldFiscal = mapUserData({
    agentData: { agentId: "a-3", usesDigitalBilling: false },
    token: "t",
  });
  assert.equal(oldFiscal.modoFacturacion, "fiscal", "y una caja con maquina fiscal sigue fiscal");
});

test("modo simple: la venta se envía sin resolver canal y sin exigir POS80 (S3)", async () => {
  // El caso del papel que NO tiene que salir: servicio fiscal vivo y POS80 sin
  // emparejar. En `fiscal` esto seria un error de canal; en `simple` no hay
  // canal que mirar, asi que la venta se registra igual.
  setSimpleProfile();
  usbState.paired = false;
  setCart(makeCart("ORD-SIMPLE-1"));

  const result = await store().registerSale("local");

  assert.notEqual(result, null, "la venta se registra: simple no es 'no registrar' (S2)");
  assert.equal(submits.length, 1, "la orden se envia una sola vez");
  assert.equal(invoice.calls.length, 0, "no se le pide comprobante a la maquina fiscal");
  assert.equal(healthCalls, 0, "no se consulta /health: no hay canal que resolver");
  assert.equal(usbState.transfers, 0, "la POS80 no imprimio");
  assert.equal(usbState.requests, 0, "tampoco se abre el selector WebUSB");
  assert.equal(store().errorMessage, null, "sin mensaje de error de canal");
  assert.doesNotMatch(String(store().errorMessage), /POS80|emparejada|servicio fiscal/i);
  assert.match(String(store().infoMessage), /simple/i, "el mensaje dice en que modo salio");
});

test("modo simple: el envío va por la ruta en la que el backend emite el documento", async () => {
  // Una venta `simple` no lleva numero de control local, y el unico contrato del
  // backend que acepta una orden sin el es el de emision por backend
  // (`insertorder`, `docs/migracion-typescript/apis-consumidas/ordenes.md:227`).
  setSimpleProfile();
  setCart(makeCart("ORD-SIMPLE-2"));

  await store().registerSale("local");

  assert.equal(submits.length, 1);
  assert.equal(
    submits[0].saleType,
    "digital",
    "se envia por la ruta de emision del backend, no por /orders/local",
  );
  assert.equal(submits[0].sessionId, SESSION.id, "la venta queda atada a su sesion de caja");
  assert.equal(
    submits[0].order.numeroControlInterno,
    null,
    "no se inventa un numero de control: la numeracion SIMPLE- la pone el backend",
  );
  assert.equal(submits[0].order.canal, undefined, "no se declara un canal que no se resolvio");
});

test("modo simple: si el envío falla, se informa el motivo real y no se imprime nada", async () => {
  setSimpleProfile();
  usbState.paired = true; // aunque hubiera impresora, no es un canal de salida
  cashierAccountantService.submitOrder = async () => {
    const error = new Error("Network Error");
    error.response = { status: 502, data: { message: "el servicio de órdenes no respondió" } };
    throw error;
  };
  setCart(makeCart("ORD-SIMPLE-3"));

  const result = await store().registerSale("local");

  assert.equal(result, null, "sin respuesta no hay venta que declarar");
  assert.equal(invoice.calls.length, 0, "no se pide comprobante local");
  assert.equal(usbState.transfers, 0, "ni se inventa papel por POS80");
  assert.equal(healthCalls, 0, "y no se resuelve canal para decidir nada");
  assert.match(String(store().errorMessage), /no se pudo enviar/i, "dice que fallo el envio");
  assert.match(
    String(store().errorMessage),
    /el servicio de órdenes no respondió/,
    "y conserva el motivo real del backend",
  );
  assert.match(
    String(store().errorMessage),
    /pudo haberse registrado/i,
    "no afirma que la venta no existe cuando no puede saberlo",
  );
  assert.doesNotMatch(String(store().errorMessage), /POS80|emparejada/i);
});

test("modo simple: la sesión adopta el modo cuando el backend emite SIMPLE-", async () => {
  // El login guarda una foto del modo y el refresh del JWT la reutiliza: una
  // sesión abierta puede quedar en el modo viejo. El control emitido es la
  // evidencia fresca; si es SIMPLE-, la farmacia es simple.
  assert.equal(detectBillingModeDrift("digital", "SIMPLE-1"), "simple");
  assert.equal(detectBillingModeDrift("fiscal", "SIMPLE-27"), "simple");
  assert.equal(detectBillingModeDrift(undefined, "simple-3"), "simple");
  assert.equal(detectBillingModeDrift("simple", "SIMPLE-1"), null, "ya estaba bien");
  assert.equal(detectBillingModeDrift("fiscal", "00032015"), null, "un COO no cambia nada");
  assert.equal(detectBillingModeDrift("digital", null), null);
});
