/**
 * Tests a nivel de store para la atadura caja↔terminal (P2 de
 * `cash-session-attribution`).
 *
 * Corren el store REAL (`useCashierWorkflowStore`) contra un fake fiel al backend
 * arreglado, reemplazando solo el servicio HTTP. Son la red que faltaba: B1 —el
 * segundo `load()` de una cajera SIN caja asignada mandaba un `caja_id` que el
 * backend autoriza únicamente para `agents.cajaId` y por lo tanto respondía 403,
 * limpiando la sesión y dejando el terminal sin poder vender— no lo puede atrapar
 * ningún test puro del módulo, porque vive en el cableado del store.
 *
 * Run: npm run test:session-binding-load
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  resetCashierServiceMock,
  cashierServiceCalls,
} from "./fixtures/cashier-service-mock.mjs";
import { useAuthStore } from "../modules/auth/store/useAuthStore.ts";
import { useCashierWorkflowStore } from "../modules/cash-register/store/cashier-workflow.store.ts";

const PHARMACY_ID = "PH-1";
const CAJA_1 = { id: "ses-1", cashBoxId: "caja-1", cashBoxName: "Caja 1", approvalStatus: "approved" };
const CAJA_2 = { id: "ses-2", cashBoxId: "caja-2", cashBoxName: "Caja 2", approvalStatus: "approved" };
const CASH_BOXES = [
  { id: "caja-1", name: "Caja 1" },
  { id: "caja-2", name: "Caja 2" },
];

function setProfile(cajaId) {
  useAuthStore.setState({
    profile: {
      id: "agent-1",
      name: "Ana",
      email: "ana@example.com",
      role: "agent",
      permits: [],
      pharmacyId: PHARMACY_ID,
      cajaId,
    },
  });
}

function storeState() {
  return useCashierWorkflowStore.getState();
}

function lastSessionCall() {
  const calls = cashierServiceCalls("fetchActiveSession");
  return calls[calls.length - 1];
}

beforeEach(() => {
  useAuthStore.setState({ profile: null });
  useCashierWorkflowStore.setState({
    activeSession: null,
    sessionInvoices: [],
    sessionTransactions: [],
    selectedCashBoxId: null,
    errorMessage: null,
    infoMessage: null,
    cashBoxes: [],
    pharmacyId: undefined,
    isLoading: false,
  });
});

test("B1: sin caja asignada, el segundo load() no manda caja_id y conserva la sesión", async () => {
  resetCashierServiceMock({ assignedCajaId: null, openSessions: [CAJA_1], cashBoxes: CASH_BOXES });
  setProfile(null);

  await storeState().load(PHARMACY_ID);

  assert.equal(storeState().activeSession?.id, "ses-1", "el primer load conserva la sesión");
  assert.equal(storeState().errorMessage, null);
  assert.equal(lastSessionCall().args[0], undefined, "el primer load va sin caja_id");

  await storeState().load(PHARMACY_ID);

  const calls = cashierServiceCalls("fetchActiveSession");
  assert.equal(calls.length, 2);
  assert.equal(
    calls[1].args[0],
    undefined,
    "el segundo load NO debe mandar caja_id: derivarlo de la sesión es circular (B1)",
  );
  assert.equal(storeState().activeSession?.id, "ses-1", "la sesión sobrevive al segundo load");
  assert.equal(storeState().errorMessage, null, "no aparece un 403 espurio");
});

test("con caja asignada, cada load manda esa caja y conserva la sesión", async () => {
  resetCashierServiceMock({
    assignedCajaId: "caja-1",
    openSessions: [CAJA_1],
    cashBoxes: CASH_BOXES,
  });
  setProfile("caja-1");

  await storeState().load(PHARMACY_ID);
  await storeState().load(PHARMACY_ID);

  const calls = cashierServiceCalls("fetchActiveSession");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].args[0], "caja-1");
  assert.equal(calls[1].args[0], "caja-1");
  assert.equal(storeState().activeSession?.id, "ses-1");
  assert.equal(storeState().errorMessage, null);
});

test("sin caja asignada y dos sesiones abiertas, avisa la ambigüedad y no adivina", async () => {
  resetCashierServiceMock({
    assignedCajaId: null,
    openSessions: [CAJA_1, CAJA_2],
    cashBoxes: CASH_BOXES,
  });
  setProfile(null);

  await storeState().load(PHARMACY_ID);

  assert.equal(storeState().activeSession, null, "no debe elegir una sesión en silencio");
  assert.match(String(storeState().errorMessage), /más de una sesión/i);
  assert.equal(cashierServiceCalls("fetchActiveSession")[0].args[0], undefined);
  assert.equal(
    cashierServiceCalls("fetchActiveSession").length,
    1,
    "ante 409 no debe reintentar por usuario",
  );
});

test("una 403 del backend se muestra y no deja sesión activa", async () => {
  resetCashierServiceMock({
    assignedCajaId: "caja-1",
    openSessions: [CAJA_1],
    cashBoxes: CASH_BOXES,
    forbiddenCajaIds: ["caja-1"],
  });
  setProfile("caja-1");

  await storeState().load(PHARMACY_ID);

  assert.equal(storeState().activeSession, null);
  assert.match(String(storeState().errorMessage), /no está asignada/i);
  assert.equal(
    cashierServiceCalls("fetchActiveSession").length,
    1,
    "ante 403 no debe reintentar por usuario",
  );
});

test("B1 persiste: 10 loads seguidos sin caja asignada nunca mandan caja_id", async () => {
  resetCashierServiceMock({ assignedCajaId: null, openSessions: [CAJA_1], cashBoxes: CASH_BOXES });
  setProfile(null);

  for (let i = 0; i < 10; i += 1) {
    await storeState().load(PHARMACY_ID);
    assert.equal(storeState().activeSession?.id, "ses-1", `load ${i}: conserva la sesión`);
    assert.equal(storeState().errorMessage, null, `load ${i}: sin error espurio`);
  }

  const calls = cashierServiceCalls("fetchActiveSession");
  assert.equal(calls.length, 10);
  for (let i = 0; i < 10; i += 1) {
    assert.equal(calls[i].args[0], undefined, `call ${i}: nunca manda caja_id`);
  }
});

test("con caja asignada, 10 loads seguidos siempre mandan esa caja", async () => {
  resetCashierServiceMock({ assignedCajaId: "caja-1", openSessions: [CAJA_1], cashBoxes: CASH_BOXES });
  setProfile("caja-1");

  for (let i = 0; i < 10; i += 1) {
    await storeState().load(PHARMACY_ID);
    assert.equal(storeState().errorMessage, null, `load ${i}: sin error`);
  }

  const calls = cashierServiceCalls("fetchActiveSession");
  assert.equal(calls.length, 10);
  for (const call of calls) {
    assert.equal(call.args[0], "caja-1");
  }
});

test("con caja asignada y sin sesión abierta en esa caja, no hay error espurio", async () => {
  resetCashierServiceMock({
    assignedCajaId: "caja-2",
    openSessions: [CAJA_1],
    cashBoxes: CASH_BOXES,
  });
  setProfile("caja-2");

  await storeState().load(PHARMACY_ID);

  assert.equal(storeState().activeSession, null, "esa caja no tiene sesión abierta");
  assert.equal(lastSessionCall().args[0], "caja-2");
  assert.equal(storeState().errorMessage, null, "no hay atadura rota que reportar");
});
