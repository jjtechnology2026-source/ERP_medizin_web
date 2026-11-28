// Vigilante del canal de comprobante de ESTA terminal
// (`odd/tasks/canal-comprobante-por-caja.md`, T12, Spec S5).
//
// Para que existe: la pantalla de pago lee el canal dos veces (al abrir el
// dialogo y al cobrar). Si el servicio se cae en el medio, el cajero se entera
// recien al fallar la venta. El vigilante sondea el canal cada pocos segundos
// para que el operador lo VEA antes de cobrar.
//
// Lo que NO es: una fuente de verdad. Su valor puede tener segundos de
// antiguedad, asi que nunca decide una venta. La venta resuelve fresco con
// `resolveTerminalChannel()` (mismo `channel-detect.ts`); esto solo anticipa la
// UI. Mezclar los dos roles es lo que vuelve a introducir el estado viejo que
// S5 prohibe.
//
// Tampoco toca `service_fiscal`: el servicio ya expone `/health` y eso alcanza
// (L9 del documento). El estado `actualizando` que proponia T9 se descarto.
//
// Reglas:
//  - Sondeo periodico (~10 s por defecto) y publicacion del ultimo
//    `ChannelDecision`; se notifica solo cuando el estado CAMBIA.
//  - Un fallo aislado no cambia lo publicado: la histéresis la hace
//    `resolveSaleChannel` (`absenceAttempts`), no este modulo. Si el sondeo se
//    cae entero, se conserva la ultima decision y solo se marca `isStale`.
//  - No se sondea con la pestana oculta, y al volver a visible se refresca de
//    inmediato: un sondeo cada 10 s durante horas contra un servicio local es
//    ruido sin valor.
//  - `start()`/`stop()` son idempotentes y dejan un solo timer vivo.

import {
  resolveTerminalChannel,
  type ChannelDecision,
  type ResolveChannelOptions,
} from "./channel-detect.ts";

/** Cada cuanto se sondea el canal, en ms. */
export const DEFAULT_WATCH_INTERVAL_MS = 10_000;

/** Antiguedad a partir de la cual se declara la decision como no fresca, en ms. */
export const DEFAULT_STALE_AFTER_MS = 30_000;

/**
 * Lo que consume la UI. `decision` es `null` hasta el primer sondeo; `isStale`
 * dice si lo publicado sigue confirmado o quedo viejo (pestana oculta, sondeos
 * que fallan).
 */
export interface ChannelStatusSnapshot {
  decision: ChannelDecision | null;
  isStale: boolean;
}

/**
 * Dependencias inyectables, igual que `resolveSaleChannel`: el vigilante no
 * toca red, hardware, reloj ni `document` por si mismo, asi que se prueba con
 * dobles y sin timers reales. Los seams REALES de la terminal viven en
 * `defaultWatchdogInput()`.
 */
export interface ChannelWatchdogDeps {
  /** Sondea el canal. Es el unico punto que puede fallar. */
  resolve: () => Promise<ChannelDecision>;
  /** Reloj de pared, en ms. */
  now: () => number;
  /** Programa un timer y devuelve su handle. */
  setTimeout: (callback: () => void, ms: number) => unknown;
  /** Cancela un timer programado. */
  clearTimeout: (handle: unknown) => void;
  /** true si la pestana esta oculta (no se sondea). */
  isHidden: () => boolean;
  /** Avisa cuando cambia la visibilidad. Devuelve el desuscriptor. */
  onVisibilityChange: (listener: () => void) => () => void;
}

export interface ChannelWatchdogOptions extends Partial<ChannelWatchdogDeps> {
  /** Intervalo entre sondeos, en ms. */
  intervalMs?: number;
  /** Antiguedad que vuelve vieja la decision, en ms. */
  staleAfterMs?: number;
  /** Opciones para `resolveTerminalChannel` (por ejemplo `absenceAttempts`). */
  resolveOptions?: ResolveChannelOptions;
}

export interface ChannelWatchdog {
  /** Arranca el sondeo. Idempotente: dos llamadas dejan un solo timer. */
  start: () => void;
  /** Corta el sondeo y suelta el oyente de visibilidad. Idempotente. */
  stop: () => void;
  /** Suscripcion para `useSyncExternalStore`. */
  subscribe: (listener: () => void) => () => void;
  /** Ultimo estado publicado. Devuelve siempre el mismo objeto si no cambio. */
  getSnapshot: () => ChannelStatusSnapshot;
}

function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function watchDocumentVisibility(listener: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

/**
 * Dos decisiones son el mismo estado si todo lo observable coincide. El objeto
 * se reconstruye en cada sondeo, pero la UI solo tiene que enterarse cuando
 * cambia algo: comparar por referencia haria parpadear el canal en pantalla.
 */
function sameDecision(a: ChannelDecision | null, b: ChannelDecision | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.channel === b.channel &&
    a.ready === b.ready &&
    a.service === b.service &&
    a.machine === b.machine &&
    a.reason === b.reason
  );
}

/**
 * Crea un vigilante. Sin `resolve` inyectado sondea la terminal real con
 * `resolveTerminalChannel()`, que es la misma deteccion que usa la venta.
 */
export function createChannelWatchdog(options: ChannelWatchdogOptions = {}): ChannelWatchdog {
  const intervalMs = Math.max(1, options.intervalMs ?? DEFAULT_WATCH_INTERVAL_MS);
  const staleAfterMs = Math.max(intervalMs, options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS);

  const resolve =
    options.resolve ?? (() => resolveTerminalChannel(options.resolveOptions ?? {}));
  const now = options.now ?? (() => Date.now());
  const schedule = options.setTimeout ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const cancel =
    options.clearTimeout ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const isHidden = options.isHidden ?? isDocumentHidden;
  const onVisibilityChange = options.onVisibilityChange ?? watchDocumentVisibility;

  const listeners = new Set<() => void>();
  let snapshot: ChannelStatusSnapshot = { decision: null, isStale: true };
  let decision: ChannelDecision | null = null;
  let confirmedAt: number | null = null;
  let isStale = true;
  let running = false;
  let polling = false;
  let timer: unknown = null;
  let releaseVisibility: (() => void) | null = null;

  /** La frescura se mide por antiguedad de la ultima confirmacion. */
  function staleness(): boolean {
    if (confirmedAt === null) return true;
    return now() - confirmedAt > staleAfterMs;
  }

  function publish(): void {
    isStale = staleness();
    if (sameDecision(snapshot.decision, decision) && snapshot.isStale === isStale) return;
    snapshot = { decision, isStale };
    for (const listener of [...listeners]) listener();
  }

  function clearTimer(): void {
    if (timer === null) return;
    cancel(timer);
    timer = null;
  }

  /** Programa el proximo sondeo. Con la pestana oculta no queda ningun timer. */
  function scheduleNext(): void {
    clearTimer();
    if (!running || isHidden()) return;
    timer = schedule(() => {
      timer = null;
      void tick();
    }, intervalMs);
  }

  async function tick(): Promise<void> {
    if (!running) return;
    if (isHidden()) return; // se retoma con el evento de visibilidad
    await poll();
  }

  async function poll(): Promise<void> {
    if (polling) return; // un solo sondeo en vuelo
    polling = true;
    let next: ChannelDecision | null = null;
    try {
      next = await resolve();
    } catch {
      // Un sondeo que revienta no es evidencia de nada: se conserva la ultima
      // decision confirmada (R3) y la frescura se resuelve por antiguedad.
      next = null;
    } finally {
      polling = false;
    }

    if (!running) return; // `stop()` a mitad de sondeo no publica nada

    if (next) {
      decision = next;
      confirmedAt = now();
    }
    publish();
    scheduleNext();
  }

  /** Al volver a visible se refresca en el acto y se retoma el periodo. */
  function handleVisibilityChange(): void {
    if (!running) return;
    if (isHidden()) {
      clearTimer(); // cero sondeos mientras la pestana este oculta
      return;
    }
    clearTimer();
    void poll();
  }

  function start(): void {
    if (running) return; // idempotente: dos start() no dejan dos timers
    running = true;
    releaseVisibility = onVisibilityChange(handleVisibilityChange);
    // Arrancar oculto no sondea: el evento de visibilidad lo despierta.
    if (isHidden()) return;
    void poll();
  }

  function stop(): void {
    running = false;
    clearTimer();
    if (releaseVisibility) {
      releaseVisibility();
      releaseVisibility = null;
    }
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): ChannelStatusSnapshot {
    // La antiguedad se evalua al leer, no solo al sondear: si el vigilante esta
    // en pausa (pestana oculta), nadie refresco el estado y la UI tiene que
    // poder decirlo. Solo se reconstruye el objeto cuando el booleano cambia,
    // asi `useSyncExternalStore` no entra en un bucle de renders.
    const nowStale = staleness();
    if (nowStale !== snapshot.isStale) {
      snapshot = { decision: snapshot.decision, isStale: nowStale };
    }
    return snapshot;
  }

  return { start, stop, subscribe, getSnapshot };
}

/**
 * Vigilante de ESTA terminal, con los clientes reales. Es el que monta el hook
 * `useChannelStatus`: la lista de dependencias vive aca y en ningun otro lado.
 */
export const channelWatchdog: ChannelWatchdog = createChannelWatchdog();

export default channelWatchdog;
