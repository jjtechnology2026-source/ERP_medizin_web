/**
 * Vigilante del canal de la terminal (`odd/tasks/canal-comprobante-por-caja.md`,
 * T12, Spec S5).
 *
 * El vigilante NO decide una venta: solo mantiene fresco lo que el operador ve
 * ANTES de cobrar. Sus reglas:
 *
 *  - sondea el canal cada N ms y publica el ultimo `ChannelDecision`;
 *  - un fallo aislado no cambia el estado publicado (la confirmacion la hace
 *    `resolveSaleChannel`, no el vigilante);
 *  - la ausencia sostenida si lo cambia;
 *  - no sondea con la pestana oculta y refresca al volver a visible;
 *  - `start()`/`stop()` son idempotentes y dejan un solo timer vivo;
 *  - `getSnapshot()`/`subscribe()` sirven para `useSyncExternalStore`.
 *
 * Todo corre con reloj/scheduler y visibilidad inyectados: ningun test espera
 * un segundo real ni toca la red.
 *
 * Run: node --experimental-strip-types --test test/channel-watchdog.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  createChannelWatchdog,
  channelWatchdog,
} from "../modules/cash-register/lib/channel-watchdog.ts";
import { resolveSaleChannel } from "../modules/cash-register/lib/channel-detect.ts";

/**
 * Deja correr las promesas pendientes sin esperar ningun intervalo real: solo
 * turnos de la cola de eventos. Hace falta tambien el turno de los timers
 * porque la confirmacion de `resolveSaleChannel` espera 0 ms entre lecturas;
 * con eso alcanza y ningun test depende del intervalo de 10 s.
 */
async function flush(rounds = 4) {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Scheduler falso: el reloj solo avanza cuando el test lo pide y `advance()`
 * ejecuta, en orden, cada timer que vence en ese lapso.
 */
function fakeScheduler(startMs = 0) {
  let nowMs = startMs;
  let nextId = 1;
  const timers = new Map();

  async function advance(ms) {
    const target = nowMs + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      nowMs = due[1].at;
      due[1].callback();
      await flush();
    }
    nowMs = Math.max(nowMs, target);
  }

  return {
    now: () => nowMs,
    setTimeout: (callback, ms) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, at: nowMs + ms });
      return id;
    },
    clearTimeout: (handle) => {
      timers.delete(handle);
    },
    pending: () => timers.size,
    advance,
  };
}

/** `document.visibilityState` falso, con sus oyentes. */
function fakeVisibility(hidden = false) {
  let isHidden = hidden;
  const listeners = new Set();
  return {
    isHidden: () => isHidden,
    onVisibilityChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setHidden(next) {
      isHidden = next;
      for (const listener of [...listeners]) listener();
    },
    listeners: () => listeners.size,
  };
}

const FISCAL = {
  channel: "fiscal",
  ready: true,
  service: "vivo",
  machine: "ok",
  reason: "El servicio fiscal está activo en esta terminal.",
};

const POS80 = {
  channel: "pos80",
  ready: true,
  service: "ausente",
  machine: "ok",
  reason: "El servicio fiscal no está instalado o no responde. El comprobante sale por la POS80.",
};

const INTERVAL = 1000;
const STALE_AFTER = 3000;

/**
 * Instancia con todo inyectado. `resolve` recibe el numero de sondeo (1-based)
 * para que un test pueda decidir que contesta cada vuelta.
 */
function setup({ resolve = async () => FISCAL, hidden = false, start = true } = {}) {
  const scheduler = fakeScheduler();
  const visibility = fakeVisibility(hidden);
  let calls = 0;

  const watchdog = createChannelWatchdog({
    resolve: async () => {
      calls += 1;
      return resolve(calls);
    },
    now: scheduler.now,
    setTimeout: scheduler.setTimeout,
    clearTimeout: scheduler.clearTimeout,
    isHidden: visibility.isHidden,
    onVisibilityChange: visibility.onVisibilityChange,
    intervalMs: INTERVAL,
    staleAfterMs: STALE_AFTER,
  });

  const notices = [];
  watchdog.subscribe(() => notices.push(watchdog.getSnapshot()));

  if (start) watchdog.start();

  return { watchdog, scheduler, visibility, notices, calls: () => calls };
}

test("el sondeo periódico publica el estado del canal", async () => {
  let current = FISCAL;
  const ctx = setup({ resolve: async () => current });
  await flush();

  assert.equal(ctx.calls(), 1, "start() sondea de inmediato");
  assert.equal(ctx.watchdog.getSnapshot().decision.channel, "fiscal");
  assert.equal(ctx.watchdog.getSnapshot().isStale, false);

  await ctx.scheduler.advance(INTERVAL);
  assert.equal(ctx.calls(), 2, "y sigue sondeando cada intervalo");

  await ctx.scheduler.advance(2 * INTERVAL);
  assert.equal(ctx.calls(), 4);

  assert.equal(ctx.notices.length, 1, "el mismo estado no se vuelve a publicar");

  // El canal cambió de verdad (el servicio dejó de responder): se publica.
  current = POS80;
  await ctx.scheduler.advance(INTERVAL);
  assert.equal(ctx.watchdog.getSnapshot().decision.channel, "pos80");
  assert.equal(ctx.notices.length, 2);

  ctx.watchdog.stop();
});

test("un fallo aislado de /health no publica un cambio de canal", async () => {
  // Histéresis real: la confirmacion la hace `resolveSaleChannel` con
  // `absenceAttempts`. El test inyecta solo el health, no la regla.
  let remainingFailures = 0;
  let healthReads = 0;
  const seams = {
    health: async () => {
      healthReads += 1;
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        throw new Error("timeout");
      }
      return { status: "ok" };
    },
    printerStatus: async () => ({ status: "ok" }),
    pos80Paired: async () => true,
  };

  const scheduler = fakeScheduler();
  const visibility = fakeVisibility();
  const watchdog = createChannelWatchdog({
    resolve: () => resolveSaleChannel(seams, { absenceAttempts: 2, confirmDelayMs: 0 }),
    now: scheduler.now,
    setTimeout: scheduler.setTimeout,
    clearTimeout: scheduler.clearTimeout,
    isHidden: visibility.isHidden,
    onVisibilityChange: visibility.onVisibilityChange,
    intervalMs: INTERVAL,
    staleAfterMs: STALE_AFTER,
  });
  const notices = [];
  watchdog.subscribe(() => notices.push(watchdog.getSnapshot()));

  watchdog.start();
  await flush();
  assert.equal(watchdog.getSnapshot().decision.channel, "fiscal");
  assert.equal(notices.length, 1);
  const published = watchdog.getSnapshot();

  // Un solo hipo: falla la primera lectura, la confirmacion lo absorbe.
  remainingFailures = 1;
  await scheduler.advance(INTERVAL);

  assert.equal(healthReads, 3, "el segundo sondeo confirmó con una segunda lectura");
  assert.equal(watchdog.getSnapshot().decision.channel, "fiscal", "un hipo no cambia el canal");
  assert.equal(notices.length, 1, "y no se publica nada a la UI");
  assert.equal(watchdog.getSnapshot(), published, "el snapshot sigue siendo el mismo objeto");

  watchdog.stop();
});

test("la ausencia sostenida sí publica el cambio a POS80", async () => {
  let serviceDown = false;
  const seams = {
    health: async () => {
      if (serviceDown) throw new Error("connection refused");
      return { status: "ok" };
    },
    printerStatus: async () => ({ status: "ok" }),
    pos80Paired: async () => true,
  };

  const scheduler = fakeScheduler();
  const visibility = fakeVisibility();
  const watchdog = createChannelWatchdog({
    resolve: () => resolveSaleChannel(seams, { absenceAttempts: 2, confirmDelayMs: 0 }),
    now: scheduler.now,
    setTimeout: scheduler.setTimeout,
    clearTimeout: scheduler.clearTimeout,
    isHidden: visibility.isHidden,
    onVisibilityChange: visibility.onVisibilityChange,
    intervalMs: INTERVAL,
    staleAfterMs: STALE_AFTER,
  });
  const notices = [];
  watchdog.subscribe(() => notices.push(watchdog.getSnapshot()));

  watchdog.start();
  await flush();
  assert.equal(watchdog.getSnapshot().decision.channel, "fiscal");

  serviceDown = true;
  await scheduler.advance(INTERVAL);

  const snapshot = watchdog.getSnapshot();
  assert.equal(snapshot.decision.channel, "pos80", "la ausencia confirmada sí cambia el canal");
  assert.equal(snapshot.decision.service, "ausente");
  assert.equal(notices.length, 2, "y se publica el cambio");

  watchdog.stop();
});

test("un sondeo que revienta conserva la decisión y la marca vieja", async () => {
  let shouldThrow = false;
  const ctx = setup({
    resolve: async () => {
      if (shouldThrow) throw new Error("boom");
      return FISCAL;
    },
  });
  await flush();
  assert.equal(ctx.watchdog.getSnapshot().decision.channel, "fiscal");
  assert.equal(ctx.watchdog.getSnapshot().isStale, false);
  const published = ctx.notices.length;

  shouldThrow = true;
  // Tres sondeos fallidos seguidos: pasa el umbral de antiguedad.
  await ctx.scheduler.advance(4 * INTERVAL);

  assert.equal(
    ctx.watchdog.getSnapshot().decision.channel,
    "fiscal",
    "un sondeo roto no borra el canal publicado",
  );
  assert.equal(ctx.watchdog.getSnapshot().decision.ready, true);
  assert.equal(ctx.watchdog.getSnapshot().isStale, true, "pero se declara que ya no está fresco");
  assert.equal(ctx.notices.length, published + 1, "solo cambia la frescura, no el canal");

  shouldThrow = false;
  await ctx.scheduler.advance(INTERVAL);
  assert.equal(ctx.watchdog.getSnapshot().isStale, false, "el sondeo bueno lo vuelve a confirmar");

  ctx.watchdog.stop();
});

test("stop() corta los sondeos y es idempotente", async () => {
  const ctx = setup();
  await flush();
  const seen = ctx.calls();

  ctx.watchdog.stop();
  ctx.watchdog.stop();

  assert.equal(ctx.scheduler.pending(), 0, "stop() limpia el timer");
  await ctx.scheduler.advance(10 * INTERVAL);
  assert.equal(ctx.calls(), seen, "después de stop() no hay más sondeos");
});

test("dos start() no dejan dos timers", async () => {
  const ctx = setup();
  ctx.watchdog.start();
  await flush();

  assert.equal(ctx.calls(), 1, "el segundo start() no arranca otro sondeo");
  assert.equal(ctx.scheduler.pending(), 1, "un solo timer vivo");

  await ctx.scheduler.advance(INTERVAL);
  assert.equal(ctx.calls(), 2, "y los sondeos no se duplican");

  ctx.watchdog.stop();
  assert.equal(ctx.scheduler.pending(), 0);
});

test("no sondea con la pestaña oculta y refresca al volver a visible", async () => {
  const ctx = setup();
  await flush();
  assert.equal(ctx.calls(), 1);

  ctx.visibility.setHidden(true);
  assert.equal(ctx.scheduler.pending(), 0, "oculta: no queda ningún timer");

  await ctx.scheduler.advance(10 * INTERVAL);
  assert.equal(ctx.calls(), 1, "con la pestaña oculta no se sondea");

  ctx.visibility.setHidden(false);
  await flush();
  assert.equal(ctx.calls(), 2, "al volver a visible refresca de inmediato");
  assert.equal(ctx.scheduler.pending(), 1, "y retoma el sondeo periódico");

  await ctx.scheduler.advance(INTERVAL);
  assert.equal(ctx.calls(), 3);

  ctx.watchdog.stop();
  assert.equal(ctx.visibility.listeners(), 0, "stop() suelta el oyente de visibilidad");
});

test("start() con la pestaña oculta espera al evento de visibilidad", async () => {
  const ctx = setup({ hidden: true });
  await flush();
  assert.equal(ctx.calls(), 0, "no se sondea al arrancar oculto");
  assert.equal(ctx.scheduler.pending(), 0);

  ctx.visibility.setHidden(false);
  await flush();
  assert.equal(ctx.calls(), 1);

  ctx.watchdog.stop();
});

test("el vigilante de la terminal expone la forma de useSyncExternalStore", () => {
  assert.equal(typeof channelWatchdog.start, "function");
  assert.equal(typeof channelWatchdog.stop, "function");
  assert.equal(typeof channelWatchdog.subscribe, "function");
  assert.equal(typeof channelWatchdog.getSnapshot, "function");

  const snapshot = channelWatchdog.getSnapshot();
  assert.equal(snapshot.decision, null, "sin start() no hay decisión inventada");
  assert.equal(snapshot.isStale, true, "y nada está confirmado todavía");
  assert.equal(channelWatchdog.getSnapshot(), snapshot, "el snapshot es estable entre lecturas");

  const unsubscribe = channelWatchdog.subscribe(() => {});
  assert.equal(typeof unsubscribe, "function");
  unsubscribe();
});
