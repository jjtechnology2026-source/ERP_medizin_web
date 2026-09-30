import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTA_CREDITO_ERROR_PREFIX,
  NOTA_CREDITO_GENERIC_ERROR,
  NOTA_CREDITO_STORED_NOT_PRINTED,
  NOTA_CREDITO_SUCCESS,
  NOTA_CREDITO_EMITTED_NOT_PERSISTED,
  decideNotaCreditoOutcome,
  normalizeNotaCreditoError,
  normalizeNotaCreditoPersistOutcome,
  extractNotaCreditoReason,
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
