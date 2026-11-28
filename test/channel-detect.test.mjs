/**
 * El canal de comprobante se DETECTA, no se configura
 * (`odd/tasks/canal-comprobante-por-caja.md`, Specs S1-S3).
 *
 *   servicio fiscal responde  -> canal = fiscal
 *   servicio fiscal ausente   -> canal = pos80
 *
 * Y la distincion que sostiene el modelo: "servicio vivo" y "maquina lista" son
 * dos cosas distintas. Con el servicio vivo y la maquina muda el canal sigue
 * siendo fiscal y `ready` es false: NUNCA POS80 (S3). Si esto cambia, el
 * fallback vuelve por la puerta de atras.
 *
 * Todo corre con seams inyectados: sin red, sin WebUSB y sin servicio fiscal.
 *
 * Run: npm run test:channel
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveSaleChannel,
  resolveTerminalChannel,
} from "../modules/cash-register/lib/channel-detect.ts";

// Sin esperas entre lecturas de confirmacion: los tests no pausan el proceso.
const FAST = { absenceAttempts: 1, confirmDelayMs: 0 };
// Un hipo aislado no declara ausencia: hacen falta dos lecturas fallidas.
const CON_CONFIRMACION = { absenceAttempts: 2, confirmDelayMs: 0 };

/** Seams por defecto: servicio vivo, maquina ok, POS80 sin emparejar. */
function seams(overrides = {}) {
  return {
    health: async () => ({ status: "ok" }),
    printerStatus: async () => ({ status: "ok" }),
    pos80Paired: async () => false,
    ...overrides,
  };
}

/** Contador de llamadas, para probar que un canal NO se consulta. */
function counted(value) {
  const counter = { calls: 0 };
  const fn = async () => {
    counter.calls += 1;
    return value;
  };
  return [fn, counter];
}

test("servicio vivo + maquina ok: canal fiscal listo", async () => {
  const decision = await resolveSaleChannel(seams(), FAST);
  assert.equal(decision.channel, "fiscal");
  assert.equal(decision.ready, true);
  assert.equal(decision.service, "vivo");
  assert.equal(decision.machine, "ok");
  assert.match(decision.reason, /servicio fiscal está activo/i);
});

test("servicio vivo + maquina que no responde: fiscal NO listo, nunca POS80 (S3)", async () => {
  const [pos80Paired, pos80] = counted(true);
  const decision = await resolveSaleChannel(
    seams({
      printerStatus: async () => {
        throw new Error("la impresora no respondió");
      },
      pos80Paired,
    }),
    FAST,
  );
  assert.equal(decision.channel, "fiscal", "un fallo de la maquina no cambia el canal");
  assert.equal(decision.ready, false);
  assert.equal(decision.service, "vivo");
  assert.equal(decision.machine, "no_responde");
  assert.match(decision.reason, /máquina fiscal/i, "el motivo nombra la maquina");
  assert.match(decision.reason, /no respondió/i, "y conserva el motivo concreto (S6)");
  assert.equal(pos80.calls, 0, "la POS80 no se consulta siquiera");
});

test("servicio ausente + POS80 emparejada: canal pos80 listo", async () => {
  const decision = await resolveSaleChannel(
    seams({
      health: async () => {
        throw new Error("connection refused");
      },
      pos80Paired: async () => true,
    }),
    FAST,
  );
  assert.equal(decision.channel, "pos80");
  assert.equal(decision.ready, true);
  assert.equal(decision.service, "ausente");
  assert.match(decision.reason, /no está instalado o no responde/i);
});

test("servicio ausente + POS80 sin emparejar: canal pos80 NO listo", async () => {
  const decision = await resolveSaleChannel(
    seams({
      health: async () => {
        throw new Error("connection refused");
      },
      pos80Paired: async () => false,
    }),
    FAST,
  );
  assert.equal(decision.channel, "pos80");
  assert.equal(decision.ready, false);
  assert.equal(decision.service, "ausente");
  assert.match(decision.reason, /no está emparejada/i);
});

test("un hipo de health seguido de una lectura buena no cambia el canal", async () => {
  let reads = 0;
  const [pos80Paired, pos80] = counted(true);
  const decision = await resolveSaleChannel(
    seams({
      health: async () => {
        reads += 1;
        if (reads === 1) throw new Error("timeout");
        return { status: "ok" };
      },
      pos80Paired,
    }),
    CON_CONFIRMACION,
  );
  assert.equal(reads, 2, "la ausencia se confirma con una segunda lectura");
  assert.equal(decision.channel, "fiscal");
  assert.equal(decision.ready, true);
  assert.equal(decision.service, "vivo");
  assert.equal(pos80.calls, 0, "un hipo no llega a preguntar por la POS80");
});

test("health y pos80Paired lanzan: no explota y queda no listo", async () => {
  const decision = await resolveSaleChannel(
    seams({
      health: async () => {
        throw new Error("connection refused");
      },
      pos80Paired: async () => {
        throw new Error("WebUSB no disponible");
      },
    }),
    FAST,
  );
  assert.equal(decision.channel, "pos80");
  assert.equal(decision.ready, false);
  assert.equal(decision.service, "ausente");
  assert.match(decision.reason, /WebUSB no disponible/i, "informa el motivo del fallo");
});

test("resolveTerminalChannel existe para el store y el dialogo de pago (sin red al importar)", () => {
  assert.equal(typeof resolveTerminalChannel, "function");
});
