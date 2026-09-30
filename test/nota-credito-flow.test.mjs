import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTA_CREDITO_ERROR_PREFIX,
  NOTA_CREDITO_GENERIC_ERROR,
  NOTA_CREDITO_STORED_NOT_PRINTED,
  NOTA_CREDITO_SUCCESS,
  decideNotaCreditoOutcome,
  normalizeNotaCreditoError,
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
