import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveAuthorizedCajaId,
  isSessionBoundToCaja,
  describeSessionBindingMismatch,
  describeSessionResolutionError,
} from "../modules/cash-register/lib/cash-session-binding.ts";
import * as binding from "../modules/cash-register/lib/cash-session-binding.ts";

// El módulo es puro: sin React, sin DOM, sin axios. Estos casos fijan el
// contrato de la atadura caja↔terminal que exige P2 de `cash-session-attribution`.

// --- resolveAuthorizedCajaId: fuente única = la caja asignada al agente ---
//
// B1 (reproducido por verificacion independiente): la version anterior tomaba
// como prioridad la caja de la sesion ya resuelta. Con eso, el segundo `load()`
// de una cajera SIN caja asignada mandaba un `caja_id` que el backend solo
// autoriza para `agents.cajaId`, y respondia 403: la sesion se limpiaba y el
// terminal quedaba bloqueado. Derivar la atadura de la misma sesion que se esta
// validando es circular: una sesion no puede validarse a si misma. Por eso la
// unica fuente es la caja asignada al agente, que es exactamente lo que el
// backend autoriza.

test("resolveAuthorizedCajaId: devuelve la caja asignada al agente", () => {
  assert.equal(resolveAuthorizedCajaId("caja:asignada"), "asignada");
  assert.equal(resolveAuthorizedCajaId("asignada"), "asignada");
});

test("resolveAuthorizedCajaId: null cuando no hay caja asignada o viene vacia", () => {
  assert.equal(resolveAuthorizedCajaId(null), null);
  assert.equal(resolveAuthorizedCajaId(undefined), null);
  assert.equal(resolveAuthorizedCajaId(""), null);
  assert.equal(resolveAuthorizedCajaId("caja:"), null);
});

test("resolveAuthorizedCajaId: ya no existe ningun resolvedor multi-fuente (B1)", () => {
  // Si este test falla, alguien reintrodujo la fuente que causaba B1.
  assert.equal(binding.resolveBoundCajaId, undefined);
});

// --- isSessionBoundToCaja: comparación normalizada contra el prefijo caja: ---

test("isSessionBoundToCaja: true cuando coinciden exactamente", () => {
  assert.equal(isSessionBoundToCaja({ cashBoxId: "abc" }, "abc"), true);
});

test("isSessionBoundToCaja: true cuando la sesión trae el prefijo caja:", () => {
  assert.equal(isSessionBoundToCaja({ cashBoxId: "caja:abc" }, "abc"), true);
});

test("isSessionBoundToCaja: true cuando la caja atada trae el prefijo caja:", () => {
  assert.equal(isSessionBoundToCaja({ cashBoxId: "abc" }, "caja:abc"), true);
});

test("isSessionBoundToCaja: true cuando ambos traen el prefijo caja:", () => {
  assert.equal(isSessionBoundToCaja({ cashBoxId: "caja:abc" }, "caja:abc"), true);
});

test("isSessionBoundToCaja: false cuando la sesión es de otra caja", () => {
  assert.equal(isSessionBoundToCaja({ cashBoxId: "caja:abc" }, "caja:def"), false);
});

test("isSessionBoundToCaja: false cuando no hay caja atada (null o vacía)", () => {
  assert.equal(isSessionBoundToCaja({ cashBoxId: "abc" }, null), false);
  assert.equal(isSessionBoundToCaja({ cashBoxId: "abc" }, ""), false);
});

test("isSessionBoundToCaja: false cuando no hay sesión", () => {
  assert.equal(isSessionBoundToCaja(null, "abc"), false);
});

test("isSessionBoundToCaja: false cuando la sesión no trae caja", () => {
  assert.equal(isSessionBoundToCaja({ cashBoxId: null }, "abc"), false);
  assert.equal(isSessionBoundToCaja({}, "abc"), false);
  assert.equal(isSessionBoundToCaja({ cashBoxId: "" }, "abc"), false);
});

// --- describeSessionResolutionError: 409/403 explícitos, null para el resto ---

test("describeSessionResolutionError: 409 explica la ambigüedad e incluye conteo y cajas", () => {
  const error = {
    response: {
      status: 409,
      data: {
        success: false,
        message:
          "Hay 2 sesiones de caja abiertas (caja:aaa, caja:bbb). Indique caja_id para elegir una",
      },
    },
  };

  const mensaje = describeSessionResolutionError(error);

  assert.ok(mensaje, "debe devolver un mensaje para 409");
  assert.match(mensaje, /2 sesiones/);
  assert.match(mensaje, /caja:aaa/);
  assert.match(mensaje, /caja:bbb/);
});

test("describeSessionResolutionError: 409 sin cuerpo igual devuelve el mensaje de ambigüedad", () => {
  const mensaje = describeSessionResolutionError({ response: { status: 409 } });

  assert.ok(mensaje, "debe devolver un mensaje para 409");
  assert.match(mensaje, /más de una sesión/i);
});

test("describeSessionResolutionError: acepta un error envuelto con status plano y su mensaje", () => {
  const mensaje = describeSessionResolutionError({
    status: 409,
    message: "Hay 2 sesiones de caja abiertas (caja:aaa, caja:bbb)",
  });

  assert.ok(mensaje, "debe devolver un mensaje para 409");
  assert.match(mensaje, /caja:aaa/);
});

test("describeSessionResolutionError: 403 dice que la caja no está asignada", () => {
  const mensaje = describeSessionResolutionError({
    response: {
      status: 403,
      data: { message: "La caja solo puede ser consultada por el agente al que está asignada" },
    },
  });

  assert.ok(mensaje, "debe devolver un mensaje para 403");
  assert.match(mensaje, /no está asignada/i);
});

test("describeSessionResolutionError: null para un error no relacionado (500 o red)", () => {
  assert.equal(
    describeSessionResolutionError({ response: { status: 500, data: { message: "boom" } } }),
    null,
  );
  assert.equal(describeSessionResolutionError(new Error("network down")), null);
  assert.equal(describeSessionResolutionError(null), null);
  assert.equal(describeSessionResolutionError(undefined), null);
});

// --- describeSessionBindingMismatch: la sesión resuelta debe ser de la caja atada ---
// Regla P2: si el backend resuelve una sesión que NO es de la caja del
// terminal (o no hay caja atada que la confirme), el store debe negarse a
// operar y avisar. La decisión es pura para poder fijarla aquí.

test("describeSessionBindingMismatch: null cuando la sesión pertenece a la caja atada", () => {
  assert.equal(describeSessionBindingMismatch({ cashBoxId: "caja:abc" }, "abc"), null);
  assert.equal(describeSessionBindingMismatch({ cashBoxId: "abc" }, "caja:abc"), null);
});

test("describeSessionBindingMismatch: avisa cuando la sesión es de otra caja", () => {
  const mensaje = describeSessionBindingMismatch({ cashBoxId: "caja:otra" }, "caja:abc");
  assert.ok(mensaje, "debe reclamar la atadura rota");
  assert.match(mensaje, /no pertenece a la caja/i);
});

test("describeSessionBindingMismatch: null cuando no hay caja atada (sin asignar ni seleccionar)", () => {
  // Regresion evitada: negarse cuando no hay caja atada bloqueaba a una cajera
  // sin `agents.cajaId` (se escribe recien al aprobar una apertura) que tiene
  // una sola sesion abierta. La ambiguedad real la cubre el 409 del backend,
  // que ahora es ruidoso; este aviso es solo para una atadura que se contradice.
  assert.equal(describeSessionBindingMismatch({ cashBoxId: "caja:abc" }, null), null);
  assert.equal(describeSessionBindingMismatch({ cashBoxId: "caja:abc" }, ""), null);
});

test("describeSessionBindingMismatch: null cuando todavía no hay sesión resuelta", () => {
  assert.equal(describeSessionBindingMismatch(null, "caja:abc"), null);
});
