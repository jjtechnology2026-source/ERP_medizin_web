// Decisiones PURAS de la emision de notas de credito desde el dialogo de facturas.
//
// Regla central: la UI NUNCA reporta exito ni imprime si la persistencia fallo.
// El comprobante "No Fiscal" de una nota de credito queda reservado al caso en
// que la NC ya se guardo (y el stock ya se devolvio) pero fallo la impresora
// fiscal; ahi solo se ofrece impresion bajo demanda, con un click explicito.
//
// Sin React, sin DOM y sin red: testeable con `node --test`.

export type NotaCreditoStep = "success" | "stored-not-printed" | "error";

export interface NotaCreditoOutcomeInput {
  /** true cuando la NC quedo persistida en el backend (y el stock se devolvio). */
  persisted: boolean;
  /** Error de persistencia cuando `persisted` es false. */
  persistError?: unknown;
  /** true cuando la impresion fiscal termino bien. Se ignora si no persistio. */
  printed?: boolean;
  /** Error de la impresora fiscal cuando `persisted` es true y `printed` false. */
  printError?: unknown;
}

export interface NotaCreditoDecision {
  step: NotaCreditoStep;
  /** Mensaje principal para el operador. */
  message: string;
  /** Motivo tecnico corto para soporte; undefined cuando no hay. */
  reason?: string;
  /** La decision NUNCA imprime por si sola. */
  shouldPrint: boolean;
  /** La UI debe ofrecer impresion "No Fiscal" bajo demanda (click explicito). */
  canPrintOnDemand: boolean;
}

export const NOTA_CREDITO_ERROR_PREFIX = "No se pudo emitir la nota de crédito";
export const NOTA_CREDITO_GENERIC_ERROR =
  "No se pudo emitir la nota de crédito. No se guardó ni se imprimió nada; verifique la conexión e intente nuevamente.";
export const NOTA_CREDITO_SUCCESS = "Nota de crédito emitida correctamente";
export const NOTA_CREDITO_STORED_NOT_PRINTED =
  "La nota de crédito se guardó y el stock fue devuelto, pero no se pudo imprimir en la impresora fiscal. Puede imprimir el comprobante No Fiscal cuando lo necesite.";

// El backend Rust puede responder el motivo en `message`, `error` o `detail`
// (es la convencion que ya usan los servicios del repo), envuelto o no en
// `response.data` / `data.data`, y a veces como string `Internal("...")`.
const MESSAGE_KEYS = ["message", "error", "detail", "details", "reason", "msg"] as const;
const NESTED_ERROR_KEYS = ["data", "response", "resp", "nota", "body"] as const;
const MAX_REASON_LENGTH = 240;

// Mensajes genericos de Axios/transporte que NO son un motivo del backend y no
// deben mostrarse como causa: si aparecen, se usa el texto honesto de respaldo.
const IGNORED_TRANSPORT_REASONS = [
  /^network error$/i,
  /^request failed with status code \d+$/i,
  /^timeout of \d+\s*ms exceeded$/i,
  /^request aborted$/i,
];

function readable(text: string): string | null {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > MAX_REASON_LENGTH
    ? `${collapsed.slice(0, MAX_REASON_LENGTH - 3).trimEnd()}...`
    : collapsed;
}

/** El backend Rust a veces serializa `AppError` como `Internal("...")`. */
function unwrapBackendError(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[A-Za-z]+\(["']([\s\S]*)["']\)$/);
  return match ? match[1] : trimmed;
}

function pickMessage(value: unknown, depth = 0): string | null {
  if (value == null) return null;
  if (typeof value === "string") return readable(unwrapBackendError(value));
  if (typeof value !== "object") return null;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickMessage(item, depth);
      if (found) return found;
    }
    return null;
  }

  const obj = value as Record<string, unknown>;
  // Primero la respuesta HTTP anidada (Axios: `response.data.message`), para no
  // quedarnos con el generico "Request failed with status code 400".
  if (depth < 3) {
    for (const key of NESTED_ERROR_KEYS) {
      const found = pickMessage(obj[key], depth + 1);
      if (found) return found;
    }
  }
  for (const key of MESSAGE_KEYS) {
    const found = pickMessage(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Extrae el motivo del backend de un error desconocido (Axios, Error, objeto o
 * string) como UNA sola linea legible. Devuelve null cuando no hay motivo usable.
 */
export function extractNotaCreditoReason(error: unknown): string | null {
  const reason = pickMessage(error);
  if (!reason) return null;
  return IGNORED_TRANSPORT_REASONS.some((rx) => rx.test(reason)) ? null : reason;
}

/**
 * Normaliza un error desconocido a un mensaje corto y accionable en espanol.
 * Nunca inventa exito ni imprime; si no hay motivo del backend usa un texto
 * honesto que aclara que no se guardo nada.
 */
export function normalizeNotaCreditoError(
  error: unknown,
  fallback: string = NOTA_CREDITO_GENERIC_ERROR,
): string {
  const reason = extractNotaCreditoReason(error);
  return reason ? `${NOTA_CREDITO_ERROR_PREFIX}: ${reason}` : fallback;
}

/**
 * Decide el proximo paso de la UI a partir de persistir y de imprimir.
 * Sesgo de seguridad: si no persistio, no hay exito y no se imprime.
 */
export function decideNotaCreditoOutcome(
  input: NotaCreditoOutcomeInput,
): NotaCreditoDecision {
  if (!input.persisted) {
    const reason = extractNotaCreditoReason(input.persistError);
    return {
      step: "error",
      message: normalizeNotaCreditoError(input.persistError),
      reason: reason ?? undefined,
      shouldPrint: false,
      canPrintOnDemand: false,
    };
  }

  if (!input.printed) {
    const reason = extractNotaCreditoReason(input.printError);
    return {
      step: "stored-not-printed",
      message: NOTA_CREDITO_STORED_NOT_PRINTED,
      reason: reason ?? undefined,
      shouldPrint: false,
      canPrintOnDemand: true,
    };
  }

  return {
    step: "success",
    message: NOTA_CREDITO_SUCCESS,
    shouldPrint: false,
    canPrintOnDemand: false,
  };
}
