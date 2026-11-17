import test from "node:test";
import assert from "node:assert/strict";
import {
  persistLocalSale,
  quoteBlockReason,
  quoteBlockReasonForCart,
  issuedFiscalForCart,
  cartSignature,
  matchesControlNumber,
} from "../modules/cash-register/lib/local-sale-persist.ts";

const ORDER = { id: "ORD-1", client: { name: "JUAN" } };
const CONTROL = "00052465";

/**
 * Doble de `submitOrder`: permite contar cuantas veces se llamo (la garantia
 * central de este modulo es que la venta se persiste UNA sola vez).
 */
function fakeSubmit(script) {
  const calls = [];
  const fn = async (order, saleType, sessionId) => {
    calls.push({ order, saleType, sessionId });
    const step = script[calls.length - 1];
    if (!step) throw new Error("submitOrder llamado mas veces de las previstas");
    if (step instanceof Error) throw step;
    return step;
  };
  return { fn, calls };
}

function fakeLookup(resolver) {
  const calls = [];
  const fn = async (controlNumber) => {
    calls.push(controlNumber);
    if (resolver instanceof Error) throw resolver;
    return resolver;
  };
  return { fn, calls };
}

function baseInputs(overrides = {}) {
  const submit = fakeSubmit([{ ordenId: "ORD-1" }]);
  const lookup = fakeLookup(false);
  return {
    inputs: {
      order: ORDER,
      saleType: "local",
      sessionId: "SES-1",
      controlNumber: CONTROL,
      submitOrder: submit.fn,
      findPersistedInvoice: lookup.fn,
      ...overrides,
    },
    submit,
    lookup,
  };
}

test("persiste al primer intento sin reconciliar ni reintentar", async () => {
  const { inputs, submit, lookup } = baseInputs();

  const outcome = await persistLocalSale(inputs);

  assert.equal(outcome.persisted, true);
  assert.equal(outcome.reconciled, false);
  assert.equal(outcome.result.ordenId, "ORD-1");
  assert.equal(submit.calls.length, 1, "no debe reenviar una venta ya persistida");
  assert.equal(lookup.calls.length, 0, "no consulta si el primer intento funciono");
});

test("si el registro falla pero el comprobante ya existe, no reenvia la venta", async () => {
  const submit = fakeSubmit([new Error("timeout del proxy")]);
  const lookup = fakeLookup(true);

  const outcome = await persistLocalSale({
    order: ORDER,
    saleType: "local",
    sessionId: "SES-1",
    controlNumber: CONTROL,
    submitOrder: submit.fn,
    findPersistedInvoice: lookup.fn,
  });

  assert.equal(outcome.persisted, true);
  assert.equal(outcome.reconciled, true);
  assert.equal(
    submit.calls.length,
    1,
    "la factura ya estaba registrada: reenviarla crearia un duplicado",
  );
  assert.equal(outcome.result.facturacion.numeroControl, CONTROL);
  assert.equal(outcome.result.facturacion.success, true);
  assert.equal(lookup.calls.length, 1);
  assert.equal(lookup.calls[0], CONTROL, "reconcilia con el control que se imprimio");
});

test("si la reconciliacion confirma que no existe, NO reenvia la orden", async () => {
  const submit = fakeSubmit([new Error("502 del backend")]);
  const lookup = fakeLookup(false);

  const outcome = await persistLocalSale({
    order: ORDER,
    saleType: "local",
    sessionId: "SES-1",
    controlNumber: CONTROL,
    submitOrder: submit.fn,
    findPersistedInvoice: lookup.fn,
  });

  // La factura se escribe en un run_facturacion desacoplado: su ausencia no
  // prueba que la orden no se guardo, y la orden no tiene clave de idempotencia.
  assert.equal(outcome.persisted, false);
  assert.equal(outcome.result, null);
  assert.equal(submit.calls.length, 1, "una sola escritura: reenviar duplica la orden");
  assert.match(outcome.error, /502 del backend/);
  assert.equal(lookup.calls.length, 1);
});

test("un fallo de transporte nunca produce dos escrituras", async () => {
  const submit = fakeSubmit([new Error("timeout del proxy")]);
  const lookup = fakeLookup(new Error("la consulta fallo"));

  const outcome = await persistLocalSale({
    order: ORDER,
    saleType: "local",
    sessionId: "SES-1",
    controlNumber: CONTROL,
    submitOrder: submit.fn,
    findPersistedInvoice: lookup.fn,
  });

  assert.equal(outcome.persisted, false);
  assert.equal(outcome.uncertainty, true);
  assert.equal(submit.calls.length, 1, "sin evidencia no se reenvia");
});

test("sin numero de control fiscal tampoco se reenvia", async () => {
  const submit = fakeSubmit([new Error("502 del backend")]);
  const lookup = fakeLookup(true);

  const outcome = await persistLocalSale({
    order: ORDER,
    saleType: "local",
    sessionId: "SES-1",
    controlNumber: "",
    submitOrder: submit.fn,
    findPersistedInvoice: lookup.fn,
  });

  assert.equal(outcome.persisted, false);
  assert.equal(lookup.calls.length, 0, "no se consulta con un control vacio");
  assert.equal(submit.calls.length, 1);
});

test("bloquea guardar presupuesto cuando la fiscal ya emitio el comprobante", () => {
  assert.equal(quoteBlockReason(null), null);
  assert.equal(quoteBlockReason(""), null);
  assert.equal(quoteBlockReason("   "), null);

  const reason = quoteBlockReason("00052465");
  assert.ok(reason, "debe explicar por que no se puede guardar como presupuesto");
  assert.match(reason, /00052465/, "el mensaje nombra el comprobante ya emitido");
  assert.match(reason, /presupuesto/i);
});

test("compara el control guardado con el impreso sin falsos negativos", () => {
  assert.equal(matchesControlNumber("00052465", "00052465"), true);
  assert.equal(matchesControlNumber("00052465", "52465"), true, "ceros a la izquierda");
  assert.equal(matchesControlNumber("000-52465", "00052465"), true, "separadores");
  assert.equal(matchesControlNumber(" 00052465 ", "00052465"), true, "espacios");

  assert.equal(matchesControlNumber("00052464", "00052465"), false, "distinto documento");
  assert.equal(matchesControlNumber("", "00052465"), false);
  assert.equal(matchesControlNumber(null, "00052465"), false);
  assert.equal(matchesControlNumber("00052465", ""), false);
  assert.equal(
    matchesControlNumber("COT-52465", "52465"),
    false,
    "una cotizacion no es el comprobante fiscal",
  );
});

test("un reintento manual consulta el libro antes de volver a enviar", async () => {
  const submit = fakeSubmit([]); // no debe llamarse
  const lookup = fakeLookup(true);

  const outcome = await persistLocalSale({
    order: ORDER,
    saleType: "local",
    sessionId: "SES-1",
    controlNumber: CONTROL,
    reconcileFirst: true,
    submitOrder: submit.fn,
    findPersistedInvoice: lookup.fn,
  });

  assert.equal(outcome.persisted, true);
  assert.equal(outcome.reconciled, true);
  assert.equal(submit.calls.length, 0, "si ya esta en el libro no se reenvia nada");
});

test("un reintento manual envia una sola vez si el libro no lo tiene", async () => {
  const submit = fakeSubmit([{ ordenId: "ORD-7" }]);
  const lookup = fakeLookup(false);

  const outcome = await persistLocalSale({
    order: ORDER,
    saleType: "local",
    sessionId: "SES-1",
    controlNumber: CONTROL,
    reconcileFirst: true,
    submitOrder: submit.fn,
    findPersistedInvoice: lookup.fn,
  });

  assert.equal(outcome.persisted, true);
  assert.equal(outcome.reconciled, false);
  assert.equal(submit.calls.length, 1);
});

test("el bloqueo de presupuesto solo aplica al carrito que emitio el comprobante", () => {
  const cartA = { id: "ORD-A", client: { documento: "V1" }, medications: [{ barCode: "P1", quantity: 1, price: 10 }] };
  const issued = {
    control: "00052465",
    serial: "HKA1",
    orderId: "ORD-A",
    signature: cartSignature(cartA),
  };

  assert.match(quoteBlockReasonForCart(issued, cartA), /00052465/, "el mismo carrito queda bloqueado");
  assert.equal(quoteBlockReasonForCart(issued, { ...cartA, id: "ORD-B" }), null, "otro carrito no lo hereda");
  assert.equal(quoteBlockReasonForCart(null, cartA), null);
  assert.equal(quoteBlockReasonForCart(issued, undefined), null);
});

test("un carrito con el mismo id pero otra mercancia no hereda el comprobante", () => {
  const cartA = { id: "ORD-A", client: { documento: "V1" }, medications: [{ barCode: "P1", quantity: 1, price: 10 }] };
  const issued = { control: "00052465", serial: null, orderId: "ORD-A", signature: cartSignature(cartA) };

  // hydrateFromQuote reemplaza el contenido conservando el id del carrito.
  const rehydrated = { id: "ORD-A", client: { documento: "V9" }, medications: [{ barCode: "P2", quantity: 3, price: 5 }] };

  assert.equal(issuedFiscalForCart(issued, rehydrated), null, "no se arrastra un COO ajeno");
  assert.equal(quoteBlockReasonForCart(issued, rehydrated), null, "y no bloquea la cotizacion");
  assert.equal(issuedFiscalForCart(issued, cartA), issued, "el carrito original lo conserva");
});

test("la huella del carrito ignora el orden de las lineas pero no su contenido", () => {
  const a = { client: { documento: "v1" }, medications: [
    { barCode: "P1", quantity: 1, price: 10 },
    { barCode: "P2", quantity: 2, price: 20 },
  ] };
  const b = { client: { documento: "V1" }, medications: [
    { barCode: "P2", quantity: 2, price: 20 },
    { barCode: "P1", quantity: 1, price: 10 },
  ] };
  assert.equal(cartSignature(a), cartSignature(b), "el orden de las lineas no cambia la venta");

  assert.notEqual(cartSignature(a), cartSignature({ ...a, medications: [{ barCode: "P1", quantity: 2, price: 10 }, a.medications[1]] }));
  assert.notEqual(cartSignature(a), cartSignature({ ...a, client: { documento: "V2" } }));
});


test("la firma del carrito no depende de la forma (crudo vs modelo)", () => {
  const raw = {
    id: "ORD-1",
    client: { documento: "" },
    medications: [{ barCode: "P1", name: "X", quantity: 1, price: 10 }],
  };
  // buildModelOrder completa el documento vacio con "V-00000000".
  const model = { ...raw, client: { ...raw.client, documento: "V-00000000" } };

  assert.equal(
    cartSignature(raw),
    cartSignature(model),
    "guardar el COO con una forma y consultarlo con otra deja el bloqueo inerte",
  );
});

test("un cambio de IVA cambia la huella: no reusa el comprobante emitido", () => {
  const cart = { id: "ORD-A", client: { documento: "V1" }, medications: [{ barCode: "P1", quantity: 1, price: 10, vat: 16 }] };
  const issued = { control: "00052465", serial: null, orderId: "ORD-A", signature: cartSignature(cart) };

  const gravado = { ...cart, medications: [{ ...cart.medications[0] }] };
  const exento = { ...cart, medications: [{ ...cart.medications[0], vat: 0 }] };

  assert.equal(issuedFiscalForCart(issued, gravado), issued, "mismo IVA: conserva el COO");
  assert.equal(
    issuedFiscalForCart(issued, exento),
    null,
    "cambiar el IVA despues de emitir exige un comprobante nuevo, no reusar el COO",
  );
  assert.notEqual(cartSignature(cart), cartSignature(exento));
});
