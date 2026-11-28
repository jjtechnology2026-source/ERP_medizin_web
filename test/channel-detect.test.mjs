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
 * "El servicio existe" no es lo mismo que "el servicio responde": un timeout, un
 * 500 o un `status` distinto de `ok` prueban que el proceso esta ahi (el canal
 * sigue siendo fiscal y `ready` es false). Solo la NEGATIVA DE CONEXION es
 * evidencia de ausencia, y se confirma con dos lecturas.
 *
 * Todo corre con seams inyectados: sin red, sin WebUSB y sin servicio fiscal.
 *
 * Run: npm run test:channel
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  resolveSaleChannel,
  resolveTerminalChannel,
  __resetChannelMemory,
} from "../modules/cash-register/lib/channel-detect.ts";

// Sin esperas entre lecturas de confirmacion: los tests no pausan el proceso.
const FAST = { absenceAttempts: 1, confirmDelayMs: 0 };
// Un hipo aislado no declara ausencia: hacen falta dos lecturas fallidas.
const CON_CONFIRMACION = { absenceAttempts: 2, confirmDelayMs: 0 };

/**
 * La gracia de reinicio (15 s) es memoria real del modulo: sin este reset un
 * caso que ve el servicio vivo contaminaria al siguiente y la ausencia de este
 * ultimo se leeria como "se esta reiniciando".
 */
beforeEach(() => __resetChannelMemory());

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

test("servicio vivo + maquina que no responde: canal fiscal, nunca POS80 (S3)", async () => {
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
  assert.equal(decision.service, "vivo");
  assert.equal(decision.machine, "no_responde");
  assert.match(decision.reason, /máquina fiscal/i, "el motivo nombra la maquina");
  assert.match(decision.reason, /no respondió/i, "y conserva el motivo concreto (S6)");
  assert.equal(pos80.calls, 0, "la POS80 no se consulta siquiera");
  // `ready` NO baja por la maquina: `printer/status` se bloquea con el lock del
  // servicio mientras una factura se imprime, y negarse a vender por eso es el
  // defecto. La factura es la que decide y su error trae el motivo real.
  assert.equal(decision.ready, true, "la maquina no puede impedir intentar la venta");
});

test("la venta no sondea la maquina: solo pregunta el canal", async () => {
  let statusCalls = 0;
  const decision = await resolveSaleChannel(
    seams({
      printerStatus: async () => {
        statusCalls += 1;
        return { status: "ok" };
      },
    }),
    { ...FAST, probeMachine: false },
  );
  assert.equal(decision.channel, "fiscal");
  assert.equal(decision.ready, true);
  assert.equal(decision.machine, "desconocido");
  assert.equal(statusCalls, 0, "la venta no espera el lock del servicio");
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

/**
 * Las tres caras del mismo defecto: el servicio EXISTE (esta instalado y su
 * proceso atiende) pero no puede emitir. Bajo ninguna circunstancia eso puede
 * elegir POS80: seria el fallback que S3 prohibe, y encima sin comprobante.
 */
const CORTO = { absenceAttempts: 2, confirmDelayMs: 0, timeoutMs: 50 };

test("health que nunca responde: el servicio existe, canal fiscal y no listo (S3)", async () => {
  const [pos80Paired, pos80] = counted(true);
  const decision = await resolveSaleChannel(
    seams({ health: () => new Promise(() => {}), pos80Paired }),
    CORTO,
  );
  assert.equal(decision.channel, "fiscal", "un timeout no es ausencia: la venta no sale por POS80");
  assert.equal(decision.ready, false, "y no se puede emitir: es error, no fallback");
  assert.notEqual(decision.service, "ausente", "el servicio esta: solo no responde");
  assert.equal(decision.service, "sin_respuesta");
  assert.match(decision.reason, /sin respuesta/i, "el motivo dice que no respondio (S6)");
  assert.equal(pos80.calls, 0, "con el servicio presente la POS80 no se consulta siquiera");
});

test("health que contesta 500: el servicio existe, canal fiscal y no listo (S3)", async () => {
  const [pos80Paired, pos80] = counted(true);
  const decision = await resolveSaleChannel(
    seams({
      health: async () => {
        throw new Error("Fiscal printer error: 500");
      },
      pos80Paired,
    }),
    CORTO,
  );
  assert.equal(decision.channel, "fiscal", "un 500 prueba que el proceso atiende");
  assert.equal(decision.ready, false);
  assert.equal(decision.service, "sin_respuesta");
  assert.match(decision.reason, /500/, "conserva el motivo concreto (S6)");
  assert.equal(pos80.calls, 0);
});

test("health que contesta { status: 'arrancando' }: canal fiscal, no listo (S3)", async () => {
  const [pos80Paired, pos80] = counted(true);
  const decision = await resolveSaleChannel(
    seams({ health: async () => ({ status: "arrancando" }), pos80Paired }),
    CORTO,
  );
  assert.equal(decision.channel, "fiscal", "el servicio contesto: no esta ausente");
  assert.equal(decision.ready, false);
  assert.equal(decision.service, "sin_respuesta");
  assert.match(decision.reason, /arrancando/, "dice en que estado esta (S6)");
  assert.equal(pos80.calls, 0);
});

test("negativa de conexion confirmada y sin lectura previa: canal POS80 (S2)", async () => {
  // Una lectura buena antes, y el reset: sin memoria no hay reinicio que valga.
  const alive = await resolveSaleChannel(seams(), FAST);
  assert.equal(alive.service, "vivo");
  __resetChannelMemory();

  let reads = 0;
  const decision = await resolveSaleChannel(
    seams({
      health: async () => {
        reads += 1;
        throw new TypeError("Failed to fetch");
      },
      pos80Paired: async () => true,
    }),
    CORTO,
  );
  assert.equal(reads, 2, "la ausencia se confirma con dos lecturas");
  assert.equal(decision.channel, "pos80");
  assert.equal(decision.service, "ausente");
  assert.equal(decision.ready, true);
});

test("negativa de conexion justo despues de una lectura buena: es reinicio, no ausencia", async () => {
  const alive = await resolveSaleChannel(seams(), FAST);
  assert.equal(alive.channel, "fiscal");
  assert.equal(alive.service, "vivo");

  const [pos80Paired, pos80] = counted(true);
  const decision = await resolveSaleChannel(
    seams({
      health: async () => {
        throw new TypeError("Failed to fetch");
      },
      pos80Paired,
    }),
    CORTO,
  );
  assert.equal(decision.channel, "fiscal", "un reinicio no manda la venta a POS80");
  assert.equal(decision.ready, false);
  assert.equal(decision.service, "sin_respuesta");
  assert.match(decision.reason, /reinici/i, "dice que el servicio se esta reiniciando (S6)");
  assert.equal(pos80.calls, 0);
});

test("resolveTerminalChannel existe para el store y el dialogo de pago (sin red al importar)", () => {
  assert.equal(typeof resolveTerminalChannel, "function");
});
