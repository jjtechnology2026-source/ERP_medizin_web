import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTA_CREDITO_ERROR_PREFIX,
  NOTA_CREDITO_GENERIC_ERROR,
  NOTA_CREDITO_STORED_NOT_PRINTED,
  NOTA_CREDITO_SUCCESS,
  NOTA_CREDITO_EMITTED_NOT_PERSISTED,
  NOTA_CREDITO_SIN_SELECCION,
  decideNotaCreditoOutcome,
  normalizeNotaCreditoError,
  normalizeNotaCreditoPersistOutcome,
  extractNotaCreditoReason,
  buildNotaCreditoLineSelection,
  validateNotaCreditoLine,
  validateNotaCreditoLineSelection,
  computeNotaCreditoLineTotal,
  computeNotaCreditoSelectionTotals,
} from "../modules/facturas/lib/nota-credito-flow.ts";

// --- Persistencia fallida: nunca exito, nunca impresion ---

test("persistencia falla: paso error con el motivo real del backend y sin imprimir", () => {
  const backendError = {
    response: {
      status: 400,
      data: { message: "La sesión indicada no está abierta y aprobada para operar" },
    },
  };

  const decision = decideNotaCreditoOutcome({
    persisted: false,
    persistError: backendError,
  });

  assert.equal(decision.step, "error");
  assert.ok(decision.message.includes("La sesión indicada no está abierta y aprobada para operar"));
  assert.ok(decision.message.startsWith(NOTA_CREDITO_ERROR_PREFIX));
  // La impresora nunca se usa en este camino.
  assert.equal(decision.shouldPrint, false);
  assert.equal(decision.canPrintOnDemand, false);
});

test("persistencia falla sin motivo del backend: mensaje generico honesto, sin exito ni impresion", () => {
  const decision = decideNotaCreditoOutcome({ persisted: false, persistError: {} });

  assert.equal(decision.step, "error");
  assert.equal(decision.message, NOTA_CREDITO_GENERIC_ERROR);
  assert.notEqual(decision.step, "success");
  assert.equal(decision.shouldPrint, false);
  assert.equal(decision.canPrintOnDemand, false);
});

test("persistencia falla con error de transporte sin respuesta: generico honesto", () => {
  const decision = decideNotaCreditoOutcome({
    persisted: false,
    persistError: new Error("Network Error"),
  });

  // "Network Error" no es un motivo del backend: el dialogo muestra el texto honesto,
  // no un mensaje tecnico en ingles que parezca una causa de negocio.
  assert.equal(decision.step, "error");
  assert.equal(decision.message, NOTA_CREDITO_GENERIC_ERROR);
  assert.equal(decision.shouldPrint, false);
});

// --- Persistencia OK: recien ahi importa la impresora ---

test("persistencia ok + impresion fiscal ok: paso exito", () => {
  const decision = decideNotaCreditoOutcome({ persisted: true, printed: true });

  assert.equal(decision.step, "success");
  assert.equal(decision.message, NOTA_CREDITO_SUCCESS);
  assert.equal(decision.shouldPrint, false);
  assert.equal(decision.canPrintOnDemand, false);
});

test("persistencia ok + impresora fiscal falla: guardada sin imprimir, impresion bajo demanda", () => {
  const decision = decideNotaCreditoOutcome({
    persisted: true,
    printed: false,
    printError: new Error("La impresora fiscal no devolvió número de control"),
  });

  assert.equal(decision.step, "stored-not-printed");
  assert.equal(decision.message, NOTA_CREDITO_STORED_NOT_PRINTED);
  assert.ok(decision.message.includes("se guardó"));
  assert.ok(decision.message.includes("no se pudo imprimir"));
  // La nota ya esta guardada: se ofrece imprimir "No Fiscal" SOLO con un click.
  assert.equal(decision.shouldPrint, false);
  assert.equal(decision.canPrintOnDemand, true);
  assert.equal(decision.reason, "La impresora fiscal no devolvió número de control");
});

// --- Normalizacion de errores del backend ---

test("motivo anidado y largo: queda en una sola linea legible", () => {
  const longReason = `Fallo la emisión.\n\nDetalle: ${"x".repeat(600)}`;
  const error = { response: { data: { data: { message: longReason } } } };

  const reason = extractNotaCreditoReason(error);
  assert.ok(reason);
  assert.ok(!reason.includes("\n"), "el motivo no debe traer saltos de linea");
  assert.ok(reason.length <= 240);
  assert.ok(reason.startsWith("Fallo la emisión. Detalle:"));
});

test("normaliza el envoltorio interno del backend: data.data.message", () => {
  const error = { response: { data: { data: { message: "Motivo desde envelope interno" } } } };
  const message = normalizeNotaCreditoError(error);
  assert.equal(message, `${NOTA_CREDITO_ERROR_PREFIX}: Motivo desde envelope interno`);
});

test("normaliza error.error del backend", () => {
  const message = normalizeNotaCreditoError({
    response: { data: { error: "Error de validacion del backend" } },
  });
  assert.equal(message, `${NOTA_CREDITO_ERROR_PREFIX}: Error de validacion del backend`);
});

test("normaliza un cuerpo string con AppError::Internal(...)", () => {
  const message = normalizeNotaCreditoError({
    response: { data: 'Internal("La sesión indicada no está abierta")' },
  });
  assert.equal(message, `${NOTA_CREDITO_ERROR_PREFIX}: La sesión indicada no está abierta`);
});

test("normaliza error.detail del cliente de impresora fiscal", () => {
  const message = normalizeNotaCreditoError({ response: { data: { detail: "printer offline" } } });
  assert.equal(message, `${NOTA_CREDITO_ERROR_PREFIX}: printer offline`);
});

test("sin motivo usable devuelve el fallback indicado", () => {
  assert.equal(normalizeNotaCreditoError(null, "fallback"), "fallback");
  assert.equal(normalizeNotaCreditoError(undefined, "fallback"), "fallback");
  assert.equal(normalizeNotaCreditoError({ success: false }, "fallback"), "fallback");
});

// --- Camino digital/TFHKA: fiscal emitida pero NO persistida ---

test("digital: persisted false con motivo -> paso propio, no exito, sin imprimir", () => {
  const decision = decideNotaCreditoOutcome({
    persisted: false,
    persistError: "No se pudo guardar la nota (control 00-12345678)",
    fiscallyEmitted: true,
  });

  assert.equal(decision.step, "emitted-not-persisted");
  assert.notEqual(decision.step, "success");
  assert.ok(
    decision.message.includes("No se pudo guardar la nota (control 00-12345678)"),
    "el mensaje debe incluir el motivo del backend",
  );
  // Los dos hechos que importan: ya existe el documento fiscal y no se guardo el stock.
  assert.ok(decision.message.includes("ya fue emitida"));
  assert.ok(decision.message.includes("no se guardó en el sistema"));
  assert.ok(decision.message.includes("stock no fue devuelto"));
  assert.ok(decision.message.includes("No vuelva a emitir"));
  assert.equal(decision.shouldPrint, false);
  assert.equal(decision.canPrintOnDemand, false);
});

test("digital: persisted true -> paso exito, sin exito falso ni impresion", () => {
  const decision = decideNotaCreditoOutcome({
    persisted: true,
    printed: true,
    fiscallyEmitted: true,
  });

  assert.equal(decision.step, "success");
  assert.equal(decision.message, NOTA_CREDITO_SUCCESS);
  assert.equal(decision.shouldPrint, false);
  assert.equal(decision.canPrintOnDemand, false);
});

test("digital: persisted ausente/desconocido NO se trata como exito confirmado", () => {
  for (const persisted of [undefined, null, "true", 1, {}]) {
    const decision = decideNotaCreditoOutcome({
      persisted: persisted,
      persistError: "Motivo del backend",
      fiscallyEmitted: true,
    });

    assert.notEqual(decision.step, "success");
    assert.equal(decision.step, "emitted-not-persisted");
    assert.equal(decision.shouldPrint, false);
    assert.equal(decision.canPrintOnDemand, false);
  }
});

test("digital: motivo largo o multilinea del backend queda en una sola linea legible", () => {
  const longReason = `No se pudo persistir.\n\nDetalle: ${"x".repeat(600)}`;
  const decision = decideNotaCreditoOutcome({
    persisted: false,
    persistError: longReason,
    fiscallyEmitted: true,
  });

  assert.equal(decision.step, "emitted-not-persisted");
  assert.ok(decision.message.includes("No se pudo persistir."));
  assert.ok(!decision.message.includes("\n"), "no debe traer saltos de linea");
  assert.ok(decision.message.startsWith(NOTA_CREDITO_EMITTED_NOT_PERSISTED));
});

// --- Normalizacion de la respuesta TFHKA (snake_case -> camelCase, unknown seguro) ---

test("normaliza persisted + persist_error a la forma del frontend", () => {
  assert.deepEqual(
    normalizeNotaCreditoPersistOutcome({ persisted: true, persist_error: "Motivo X" }),
    { persisted: true, persistError: "Motivo X" },
  );
  assert.deepEqual(
    normalizeNotaCreditoPersistOutcome({ persisted: false, persistError: "Motivo Y" }),
    { persisted: false, persistError: "Motivo Y" },
  );
});

test("normaliza defensivamente un persisted ausente o no booleano como no persistido", () => {
  for (const raw of [undefined, null, "nope", {}, { persisted: "true" }, { persisted: 1 }]) {
    assert.deepEqual(normalizeNotaCreditoPersistOutcome(raw), {
      persisted: false,
      persistError: null,
    });
  }
  assert.deepEqual(normalizeNotaCreditoPersistOutcome({ persisted: false, persist_error: "   " }), {
    persisted: false,
    persistError: null,
  });
});

// ---------------------------------------------------------------------------
// Seleccion parcial de lineas a acreditar (caso real de produccion).
//
// Factura de 4 productos por 43.183,21 Bs de la que el cliente devuelve solo
// los dos LEVOTIROXINA (18.375,95 Bs). Antes el dialogo mandaba la factura
// entera; ahora el operador elige. Estas lineas son un fixture construido para
// clavar esos totales, no datos reales del cliente.
// ---------------------------------------------------------------------------

const FACTURA_4_LINEAS = [
  { id: "l-levo-50", producto_id: "P-LEVO-50", descripcion: "LEVOTIROXINA 50 MCG", cantidad: 2, precio_unitario_ves: 5000.0, iva_porcentaje: 16 },
  { id: "l-levo-100", producto_id: "P-LEVO-100", descripcion: "LEVOTIROXINA 100 MCG", cantidad: 1, precio_unitario_ves: 6775.95, iva_porcentaje: 0 },
  { id: "l-ome-20", producto_id: "P-OME-20", descripcion: "OMEPRAZOL 20 MG", cantidad: 3, precio_unitario_ves: 6000.0, iva_porcentaje: 16 },
  { id: "l-ibu-400", producto_id: "P-IBU-400", descripcion: "IBUPROFENO 400 MG", cantidad: 1, precio_unitario_ves: 3927.26, iva_porcentaje: 0 },
];

function conCantidad(lineas, detalleFacturaId, cantidad) {
  return lineas.map((l) => (l.detalleFacturaId === detalleFacturaId ? { ...l, cantidad } : l));
}

function conSeleccion(lineas, ids) {
  const set = new Set(ids);
  return lineas.map((l) => ({ ...l, seleccionada: set.has(l.detalleFacturaId) }));
}

// --- Estado inicial: todo seleccionado con la cantidad completa ---

test("estado inicial: todas las lineas seleccionadas con su cantidad facturada completa", () => {
  const lineas = buildNotaCreditoLineSelection(FACTURA_4_LINEAS);

  assert.equal(lineas.length, 4);
  assert.ok(lineas.every((l) => l.seleccionada === true));
  assert.deepEqual(
    lineas.map((l) => l.cantidad),
    FACTURA_4_LINEAS.map((d) => String(d.cantidad)),
  );
  assert.deepEqual(
    lineas.map((l) => l.cantidadFacturada),
    FACTURA_4_LINEAS.map((d) => d.cantidad),
  );

  // El caso "devolucion total" sigue siendo un solo click: total = factura completa.
  const totales = computeNotaCreditoSelectionTotals(lineas);
  assert.equal(totales.totalVes, 43183.21);
  assert.equal(totales.seleccionadas, 4);
  assert.equal(totales.totalLineas, 4);
  assert.equal(totales.detalles.length, 4);
});

test("estado inicial defensivo: sin detalles o detalles nulos -> lista vacia", () => {
  assert.deepEqual(buildNotaCreditoLineSelection(null), []);
  assert.deepEqual(buildNotaCreditoLineSelection(undefined), []);
  assert.deepEqual(buildNotaCreditoLineSelection([]), []);
});

// --- Subset: solo los dos LEVOTIROXINA ---

test("subconjunto: acreditar solo los dos LEVOTIROXINA da 18.375,95 y solo esas lineas", () => {
  const lineas = conSeleccion(buildNotaCreditoLineSelection(FACTURA_4_LINEAS), ["l-levo-50", "l-levo-100"]);

  const totales = computeNotaCreditoSelectionTotals(lineas);

  assert.equal(totales.totalVes, 18375.95);
  assert.equal(totales.seleccionadas, 2);
  assert.equal(totales.totalLineas, 4);
  assert.deepEqual(
    totales.detalles.map((d) => d.detalle_factura_id),
    ["l-levo-50", "l-levo-100"],
  );
  // El payload lleva SOLO las lineas elegidas, con la cantidad elegida.
  assert.deepEqual(
    totales.detalles.map((d) => d.cantidad),
    [2, 1],
  );
  // El total NUNCA es el de la factura completa.
  assert.notEqual(totales.totalVes, 43183.21);
  assert.deepEqual(validateNotaCreditoLineSelection(lineas), []);
});

// --- Validaciones de cantidad por linea ---

test("cantidad por encima de lo facturado: se rechaza con motivo explicito", () => {
  const lineas = conCantidad(buildNotaCreditoLineSelection(FACTURA_4_LINEAS), "l-levo-50", "3");

  const problemas = validateNotaCreditoLineSelection(lineas);
  assert.equal(problemas.length, 1);
  assert.ok(problemas[0].includes("LEVOTIROXINA 50 MCG"));
  assert.ok(problemas[0].includes("no puede superar lo facturado"));
  assert.ok(problemas[0].includes("2"), "el motivo debe decir el tope facturado");
});

test("cantidad cero o negativa: se rechaza con motivo explicito", () => {
  for (const cantidad of ["0", "-1", "-0.5"]) {
    const lineas = conCantidad(buildNotaCreditoLineSelection(FACTURA_4_LINEAS), "l-levo-100", cantidad);
    const problemas = validateNotaCreditoLineSelection(lineas);
    assert.equal(problemas.length, 1, `cantidad ${cantidad} debe dar un problema`);
    assert.ok(problemas[0].includes("LEVOTIROXINA 100 MCG"));
    assert.ok(problemas[0].includes("mayor a cero"));
  }
});

test("cantidad no numerica: se rechaza defensivamente con motivo explicito", () => {
  for (const cantidad of ["", "  ", "abc", "1e3", "2,5,5"]) {
    const lineas = conCantidad(buildNotaCreditoLineSelection(FACTURA_4_LINEAS), "l-ome-20", cantidad);
    const problemas = validateNotaCreditoLineSelection(lineas);
    assert.equal(problemas.length, 1, `cantidad ${JSON.stringify(cantidad)} debe dar un problema`);
    assert.ok(problemas[0].includes("no es un número válido"));
  }
});

test("nada seleccionado: se rechaza con motivo explicito en espanol", () => {
  const lineas = conSeleccion(buildNotaCreditoLineSelection(FACTURA_4_LINEAS), []);

  assert.deepEqual(validateNotaCreditoLineSelection(lineas), [NOTA_CREDITO_SIN_SELECCION]);
  assert.ok(NOTA_CREDITO_SIN_SELECCION.includes("al menos un ítem"));
});

test("una linea no seleccionada no se valida aunque su cantidad sea basura", () => {
  const lineas = conCantidad(buildNotaCreditoLineSelection(FACTURA_4_LINEAS), "l-ome-20", "xxx");
  const soloLevo = conSeleccion(lineas, ["l-levo-50", "l-levo-100"]);

  assert.deepEqual(validateNotaCreditoLineSelection(soloLevo), []);
});

// --- Cantidad parcial y redondeo ---

test("cantidad parcial (1 de 2): total correcto para esa linea", () => {
  const lineas = conSeleccion(
    conCantidad(buildNotaCreditoLineSelection(FACTURA_4_LINEAS), "l-levo-50", "1"),
    ["l-levo-50"],
  );

  const totales = computeNotaCreditoSelectionTotals(lineas);
  assert.equal(computeNotaCreditoLineTotal(lineas[0]), 5800.0);
  assert.equal(totales.totalVes, 5800.0);
  assert.deepEqual(totales.detalles.map((d) => d.cantidad), [1]);
});

test("redondeo: el total queda a 2 decimales", () => {
  const lineas = buildNotaCreditoLineSelection([
    { id: "r1", descripcion: "LINEA REDONDEO", cantidad: 3, precio_unitario_ves: 0.335, iva_porcentaje: 8 },
  ]);

  const totales = computeNotaCreditoSelectionTotals(lineas);
  // 3 * 0.335 * 1.08 = 1.0854 -> 1.09
  assert.equal(totales.totalVes, 1.09);
  assert.equal(Math.round(totales.totalVes * 100) / 100, totales.totalVes);
  assert.ok(Math.abs(totales.totalVes - 1.09) < 1e-9);
});

test("el total ignora las lineas seleccionadas con cantidad invalida", () => {
  const lineas = conCantidad(buildNotaCreditoLineSelection(FACTURA_4_LINEAS), "l-levo-50", "99");

  const totales = computeNotaCreditoSelectionTotals(lineas);
  // l-levo-50 queda fuera del payload y del total; las otras tres siguen
  // seleccionadas y validas, asi que suman su importe completo.
  assert.ok(!totales.detalles.some((d) => d.detalle_factura_id === "l-levo-50"));
  assert.equal(totales.totalVes, 6775.95 + 20880.0 + 3927.26);
  assert.notEqual(validateNotaCreditoLine(lineas[0]), null);
  assert.equal(validateNotaCreditoLine(lineas[1]), null);
});
