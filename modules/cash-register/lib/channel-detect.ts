// Canal de comprobante de la terminal: se DETECTA, no se configura.
//
// Regla del negocio (Specs S1/S2/S3 del documento
// `odd/tasks/canal-comprobante-por-caja.md`):
//
//   servicio fiscal responde  -> canal = fiscal
//   servicio fiscal ausente   -> canal = pos80
//
// Y la distincion que hace que la regla sea implementable: "servicio vivo" y
// "maquina lista" son dos cosas distintas. El servicio contesta /health aunque
// la impresora este apagada o sin cable. Por eso, con el servicio vivo y la
// maquina muda, el resultado es `ready: false` con motivo: NUNCA un ticket por
// POS80. Cambiar de canal por un fallo de la maquina es reintroducir el fallback.
//
// Solo la AUSENCIA del servicio cambia el canal, y se exige que sea sostenida:
// una lectura fallida aislada (un hipo del proceso, un antivirus, el arranque)
// no alcanza. La tarea de actualizacion del servicio lo reinicia cada 30 minutos
// (`public/install-fiscal-service.ps1:311`), y esa ventana no puede imprimir un
// ticket POS80 que la maquina fiscal nunca va a registrar.
//
// Y sobre todo: solo una NEGATIVA DE CONEXION demuestra ausencia. Un timeout, un
// 500 o un `status` distinto de `ok` prueban que el proceso existe y esta
// atendiendo, aunque no pueda emitir. Ese tercer estado (`sin_respuesta`) es
// error con motivo (S3, S6), jamas un ticket por POS80.

import fiscalPrinterClient from "../api/fiscal-printer-client.ts";
import { isPrinterPaired } from "./pos80-usb.ts";

export type SaleChannel = "fiscal" | "pos80";

/**
 * `vivo` = contesta `/health` operativo. `sin_respuesta` = existe (contesto algo
 * distinto de `ok`, o fallo sin negar la conexion, o se esta reiniciando) pero
 * no puede emitir. `ausente` = nadie atiende el puerto: la unica evidencia de
 * que el servicio no esta instalado.
 */
export type ServiceState = "vivo" | "sin_respuesta" | "ausente";

/** `desconocido` = no se consulto la maquina porque el servicio no respondia. */
export type MachineState = "ok" | "no_responde" | "desconocido";

export interface ChannelDecision {
  /** Canal con el que se emite el comprobante de esta venta. */
  channel: SaleChannel;
  /**
   * true solo si esta terminal puede emitir por `channel` en este momento.
   * Si es false, `reason` dice exactamente que falta: nunca se elige el otro
   * canal para "salir del paso".
   */
  ready: boolean;
  service: ServiceState;
  machine: MachineState;
  /** Motivo legible: por que se eligio el canal o que falta para poder emitir. */
  reason: string;
}

/**
 * Dependencias inyectables: `resolveSaleChannel` no toca red ni hardware por si
 * mismo, asi que se puede probar con dobles. Los seams REALES de la terminal
 * viven mas abajo (`resolveTerminalChannel`), en un solo lugar.
 */
export interface ChannelSeams {
  /** `GET /health` del servicio fiscal. Lanza si no responde. */
  health: () => Promise<unknown>;
  /** `GET /printer/status` del servicio fiscal. Lanza si la maquina no responde. */
  printerStatus: () => Promise<unknown>;
  /** true si la POS80 esta emparejada (consulta, sin abrir el selector). */
  pos80Paired: () => Promise<boolean>;
}

export interface ResolveChannelOptions {
  /**
   * Lecturas fallidas consecutivas que hacen falta para declarar el servicio
   * ausente. 2 = un hipo aislado no cambia el canal, pero una terminal sin
   * servicio instalado tampoco espera de mas.
   */
  absenceAttempts?: number;
  /** Espera entre lecturas de confirmacion, en ms. */
  confirmDelayMs?: number;
  /** Tiempo limite de cada lectura, en ms. */
  timeoutMs?: number;
  /**
   * Consultar tambien `printer/status` para saber como esta la maquina.
   *
   * En la VENTA va en `false`, y no es un detalle: `printer_status()` del
   * servicio toma el mismo lock que la facturacion de forma BLOQUEANTE, asi que
   * mientras una factura se esta imprimiendo el status se queda esperando. Con
   * un tope corto eso se leia como "la maquina no responde" y la caja se negaba
   * a vender sin haberlo intentado. El intento de facturar es el unico que sabe
   * la verdad, y su error trae el motivo real ("puerto ocupado", "sin papel").
   *
   * El vigilante y el cartel de la pantalla de pago lo dejan en `true`: ahi la
   * informacion es anticipacion, no una condicion para cobrar.
   */
  probeMachine?: boolean;
}

export const REASON_SERVICE_PRESENT = "El servicio fiscal está activo en esta terminal.";
export const REASON_SERVICE_ABSENT = "El servicio fiscal no está instalado o no responde.";
export const REASON_SERVICE_UNRESPONSIVE =
  "El servicio fiscal está presente pero no está operativo";

/** Tope de cada lectura, en ms. La venta no espera mas que esto por el canal. */
const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Tope del sondeo de la maquina, mas largo a proposito: `printer/status` espera
 * el lock del servicio mientras hay una factura imprimiendose. Cortarlo a 2 s
 * convierte una impresion en curso en "la maquina no responde".
 */
const MACHINE_PROBE_TIMEOUT_MS = 8000;

/**
 * Ventana de gracia de reinicio, en ms. La tarea de actualizacion del servicio
 * lo reinicia (`Stop-Process` + espera de 2 s, `public/install-fiscal-service.ps1`):
 * esa ventana de negativa de conexion NO es ausencia, es un reinicio.
 */
const RESTART_GRACE_MS = 15_000;

/**
 * Instante de la ultima lectura exitosa de `/health` en esta pestana.
 *
 * Vive en el modulo a proposito: cada venta resuelve el canal con una lectura
 * fresca (Spec S5) y, sin esta memoria, un reinicio del servicio se leeria como
 * "no esta instalado" y la venta saldria por POS80 sin comprobante fiscal.
 */
let lastHealthyAt: number | null = null;

/** Solo para tests: cada caso arranca sin memoria de la terminal. */
export function __resetChannelMemory(): void {
  lastHealthyAt = null;
}

/**
 * Seams reales de esta terminal: el servicio fiscal por HTTP local y la POS80
 * por WebUSB (solo consulta, sin abrir el selector).
 *
 * Esta lista vive aca y en ningun otro archivo: el store y el dialogo de pago
 * consumen `resolveTerminalChannel()` en vez de repetir las dependencias, que es
 * lo que terminaria en dos detecciones distintas para la misma terminal.
 *
 * Cada lectura lleva su tope: `fetch` sin `signal` deja el socket abierto, y con
 * el tope de ~6 conexiones por origen del navegador el canal quedaria atascado.
 */
function terminalSeams(timeoutMs: number): ChannelSeams {
  return {
    health: () =>
      fiscalPrinterClient.getHealth({ signal: timeoutSignal(timeoutMs) }),
    printerStatus: () =>
      fiscalPrinterClient.getPrinterStatus({ signal: timeoutSignal(timeoutMs) }),
    pos80Paired: () => isPrinterPaired(),
  };
}

/**
 * `AbortSignal.timeout` no existe en todos los entornos donde este modulo se
 * evalua (SSR, Node viejo): sin el, la lectura queda con el tope de
 * `withTimeout`, que no aborta.
 */
function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined") return undefined;
  const factory = AbortSignal as typeof AbortSignal & {
    timeout?: (ms: number) => AbortSignal;
  };
  return typeof factory.timeout === "function" ? factory.timeout(ms) : undefined;
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const shaped = error as { message?: string } | null;
  return shaped?.message || fallback;
}

/**
 * Solo una NEGATIVA DE CONEXION demuestra ausencia: nadie atendio en el puerto.
 * Todo lo demas (un 500, un estado distinto de `ok`, un timeout, un abort)
 * demuestra que el proceso existe, aunque no pueda emitir.
 */
const CONNECTION_REFUSED =
  /failed to fetch|fetch failed|econnrefused|err_connection_refused|networkerror|network error|connection refused/i;

function errorTrail(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "string") {
      parts.push(current);
      break;
    }
    const shaped = current as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      cause?: unknown;
    };
    if (shaped.name) parts.push(String(shaped.name));
    if (shaped.message) parts.push(String(shaped.message));
    if (typeof shaped.code === "string") parts.push(shaped.code);
    current = shaped.cause;
  }
  return parts.join(" | ");
}

function isConnectionRefusal(error: unknown): boolean {
  return CONNECTION_REFUSED.test(errorTrail(error));
}

/**
 * Ventana de reinicio abierta, en ms desde la ultima lectura buena. `null` si no
 * hubo lectura buena o si ya paso la gracia: ahi la negativa si es ausencia.
 */
function restartGraceMs(healthyAt: number | null): number | null {
  if (healthyAt === null) return null;
  const elapsed = Date.now() - healthyAt;
  if (elapsed < 0 || elapsed >= RESTART_GRACE_MS) return null;
  return elapsed;
}

async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: sin respuesta en ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ServiceProbe {
  state: ServiceState;
  /** Motivo concreto del fallo (Spec S6); vacio cuando el servicio esta vivo. */
  error?: string;
}

/**
 * Sondea el servicio con confirmacion y clasifica lo leido: vivo, presente pero
 * no operativo, o ausente. La distincion es el corazon de S3: confundir
 * "trabado" con "ausente" elige POS80 y la venta se emite sin comprobante.
 */
async function probeService(
  seams: ChannelSeams,
  attempts: number,
  delayMs: number,
  timeoutMs: number,
): Promise<ServiceProbe> {
  // Memoria al inicio del sondeo: si el servicio respondia hace instantes y ahora
  // rechaza la conexion, se esta reiniciando.
  const healthyBefore = lastHealthyAt;
  let lastError = "";
  // Una sola lectura que no sea negativa de conexion prueba que el proceso existe.
  let sawPresence = false;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const health = await withTimeout(seams.health(), timeoutMs, "health");
      // `status: "ok"` es el contrato actual del servicio; un objeto sin status
      // se acepta como vivo porque el solo hecho de responder ya prueba proceso.
      const status = (health as { status?: unknown } | null)?.status;
      if (status === undefined || status === "ok") {
        lastHealthyAt = Date.now();
        return { state: "vivo" };
      }
      // Contesto, con un estado que no es operativo: el servicio EXISTE.
      sawPresence = true;
      lastError = `estado del servicio: ${String(status)}`;
    } catch (error) {
      lastError = messageOf(error, "el servicio fiscal no respondió");
      if (!isConnectionRefusal(error)) sawPresence = true;
    }
    if (attempt < attempts) await sleep(delayMs);
  }

  // Cualquier lectura que no sea negativa de conexion descarta la ausencia.
  if (sawPresence) return { state: "sin_respuesta", error: lastError };

  // Ausencia solo si la negativa de conexion no cae en la ventana de reinicio.
  const grace = restartGraceMs(healthyBefore);
  if (grace !== null) {
    return {
      state: "sin_respuesta",
      error: `el servicio se está reiniciando (última respuesta hace ${(
        grace / 1000
      ).toFixed(1)} s): ${lastError}`,
    };
  }

  return { state: "ausente", error: lastError };
}

/**
 * Resuelve el canal de ESTA venta. Se llama con una lectura fresca cada vez: el
 * valor de un chequeo anterior nunca se reutiliza (Spec S5).
 */
export async function resolveSaleChannel(
  seams: ChannelSeams,
  options: ResolveChannelOptions = {},
): Promise<ChannelDecision> {
  const attempts = Math.max(1, options.absenceAttempts ?? 2);
  const delayMs = Math.max(0, options.confirmDelayMs ?? 150);
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const service = await probeService(seams, attempts, delayMs, timeoutMs);

  // Servicio PRESENTE pero no operativo: existe, solo no puede emitir. Es error
  // con motivo (S3, S6), nunca POS80 y nunca consulta de la POS80.
  if (service.state === "sin_respuesta") {
    return {
      channel: "fiscal",
      ready: false,
      service: "sin_respuesta",
      machine: "desconocido",
      reason: `${REASON_SERVICE_UNRESPONSIVE}: ${
        service.error || "sin respuesta del servicio"
      }. No se emitió comprobante.`,
    };
  }

  // Servicio ausente (sostenido): el unico caso en que el canal es POS80.
  if (service.state === "ausente") {
    let paired = false;
    let pairError: string | null = null;
    try {
      paired = await withTimeout(seams.pos80Paired(), timeoutMs, "pos80");
    } catch (error) {
      pairError = messageOf(error, "no se pudo verificar la POS80");
    }
    return {
      channel: "pos80",
      ready: paired,
      service: "ausente",
      machine: "ok",
      reason: paired
        ? `${REASON_SERVICE_ABSENT} El comprobante sale por la POS80.`
        : `${REASON_SERVICE_ABSENT} La POS80 no está emparejada${
            pairError ? `: ${pairError}` : ""
          }.`,
    };
  }

  // Servicio vivo: el canal es fiscal aunque la maquina no responda. En ese
  // caso NO hay comprobante y la venta no se registra: es S3, no un fallback.
  //
  // Ojo: `ready` NO depende de la maquina. Un status bloqueado por el lock del
  // servicio (una factura imprimiendose) no puede impedir intentar la venta;
  // el intento devuelve el motivo real. Solo el canal POS80 exige `ready`
  // (sin la impresora emparejada no hay papel posible).
  if (options.probeMachine === false) {
    return {
      channel: "fiscal",
      ready: true,
      service: "vivo",
      machine: "desconocido",
      reason: REASON_SERVICE_PRESENT,
    };
  }

  try {
    await withTimeout(
      seams.printerStatus(),
      Math.max(MACHINE_PROBE_TIMEOUT_MS, timeoutMs),
      "printer/status",
    );
    return {
      channel: "fiscal",
      ready: true,
      service: "vivo",
      machine: "ok",
      reason: REASON_SERVICE_PRESENT,
    };
  } catch (error) {
    return {
      channel: "fiscal",
      ready: true,
      service: "vivo",
      machine: "no_responde",
      reason: `El servicio fiscal está activo pero la máquina fiscal no respondió: ${messageOf(
        error,
        "sin respuesta de la impresora",
      )}. No se emitió comprobante.`,
    };
  }
}

/**
 * Canal de ESTA terminal, con los clientes reales. Es la entrada que usan la
 * venta (`cashier-workflow.store.ts`) y el dialogo de pago: mismo seam, misma
 * regla, sin la lista de dependencias duplicada en dos archivos.
 *
 * Es la unica diferencia con `resolveSaleChannel`, que queda como la version
 * con dependencias inyectables para los tests.
 */
export function resolveTerminalChannel(
  options: ResolveChannelOptions = {},
): Promise<ChannelDecision> {
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return resolveSaleChannel(terminalSeams(timeoutMs), options);
}
