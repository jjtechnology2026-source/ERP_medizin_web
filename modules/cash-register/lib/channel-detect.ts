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

import fiscalPrinterClient from "../api/fiscal-printer-client.ts";
import { isPrinterPaired } from "./pos80-usb.ts";

export type SaleChannel = "fiscal" | "pos80";

export type ServiceState = "vivo" | "ausente";

export type MachineState = "ok" | "no_responde";

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
}

export const REASON_SERVICE_PRESENT = "El servicio fiscal está activo en esta terminal.";
export const REASON_SERVICE_ABSENT = "El servicio fiscal no está instalado o no responde.";

/**
 * Seams reales de esta terminal: el servicio fiscal por HTTP local y la POS80
 * por WebUSB (solo consulta, sin abrir el selector).
 *
 * Esta lista vive aca y en ningun otro archivo: el store y el dialogo de pago
 * consumen `resolveTerminalChannel()` en vez de repetir las dependencias, que es
 * lo que terminaria en dos detecciones distintas para la misma terminal.
 */
const terminalSeams: ChannelSeams = {
  health: () => fiscalPrinterClient.getHealth(),
  printerStatus: () => fiscalPrinterClient.getPrinterStatus(),
  pos80Paired: () => isPrinterPaired(),
};

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const shaped = error as { message?: string } | null;
  return shaped?.message || fallback;
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

/**
 * Sondea el servicio con confirmacion. Devuelve el estado y, si respondio, la
 * unica senal que hace falta para el canal: vivo.
 */
async function probeService(
  seams: ChannelSeams,
  attempts: number,
  delayMs: number,
  timeoutMs: number,
): Promise<{ state: ServiceState; error?: string }> {
  let lastError = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const health = await withTimeout(seams.health(), timeoutMs, "health");
      // `status: "ok"` es el contrato actual del servicio; un objeto sin status
      // se acepta como vivo porque el solo hecho de responder ya prueba proceso.
      const status = (health as { status?: string } | null)?.status;
      if (status === undefined || status === "ok") return { state: "vivo" };
      lastError = `estado del servicio: ${status}`;
    } catch (error) {
      lastError = messageOf(error, "el servicio fiscal no respondió");
    }
    if (attempt < attempts) await sleep(delayMs);
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
  const timeoutMs = Math.max(1, options.timeoutMs ?? 2000);

  const service = await probeService(seams, attempts, delayMs, timeoutMs);

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
  try {
    await withTimeout(seams.printerStatus(), timeoutMs, "printer/status");
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
      ready: false,
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
  return resolveSaleChannel(terminalSeams, options);
}
