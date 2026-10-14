/**
 * Atadura caja↔terminal (P2 de `cash-session-attribution`).
 *
 * Módulo puro: sin React, sin DOM, sin I/O. En una farmacia con más de una caja
 * el terminal debe operar sobre SESIÓN de SU caja; este módulo resuelve cuál es
 * esa caja, verifica que la sesión activa pertenezca a ella y traduce los
 * errores 409/403 que devuelve el backend a mensajes accionables.
 */

const CAJA_PREFIX = "caja:";

const AMBIGUOUS_SESSION_MESSAGE =
  "Hay más de una sesión de caja abierta para este usuario. Elige la caja de este terminal o cierra la sesión sobrante antes de cobrar.";

const CAJA_NOT_ASSIGNED_MESSAGE =
  "Esta caja no está asignada a tu usuario. Pide al administrador que asigne la caja correcta a este terminal antes de operar.";

const SESSION_NOT_BOUND_MESSAGE =
  "La sesión activa no pertenece a la caja de este terminal. Verifica la caja asignada a este terminal y cierra la sesión de la otra caja antes de cobrar.";

function normalizeCajaId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.startsWith(CAJA_PREFIX) ? value.slice(CAJA_PREFIX.length) : value;
  return stripped.length > 0 ? stripped : null;
}

function readStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.response?.status === "number") return candidate.response.status;
  return null;
}

function readServerMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    message?: unknown;
    body?: { message?: unknown };
    data?: { message?: unknown };
    response?: { data?: { message?: unknown } };
  };
  const message =
    candidate.response?.data?.message ??
    candidate.body?.message ??
    candidate.data?.message ??
    candidate.message;
  return typeof message === "string" && message.trim().length > 0 ? message : null;
}

/**
 * Resuelve la caja **autorizada** para este terminal: la caja asignada al
 * agente (`profile.cajaId`, o sea `agents.cajaId`). Es la única fuente.
 *
 * Por qué una sola fuente, y por qué no la sesión: el backend autoriza un
 * `caja_id` únicamente cuando es la caja asignada al agente, y responde 403 en
 * cualquier otro caso. Derivar la atadura de la sesión ya resuelta es circular
 * —una sesión no puede validarse a sí misma— y además hacia que el segundo
 * `load()` de una cajera SIN caja asignada mandara un `caja_id` que el backend
 * rechaza con 403, limpiando la sesión y bloqueando el terminal (B1). Sin caja
 * asignada devuelve `null`: la sesión se resuelve por usuario y una ambigüedad
 * real la delata el 409 del backend, que es ruidoso.
 */
export function resolveAuthorizedCajaId(
  assignedCajaId: string | null | undefined,
): string | null {
  return normalizeCajaId(assignedCajaId);
}

/**
 * `true` solo cuando la sesión pertenece a la caja atada. Compara ids
 * normalizados: el backend devuelve claves con prefijo (`caja:abc`) mientras el
 * frontend puede tener la clave pelada (`abc`).
 */
export function isSessionBoundToCaja(
  session: { cashBoxId?: string | null } | null,
  boundCajaId: string | null,
): boolean {
  const bound = normalizeCajaId(boundCajaId);
  if (!bound || !session) return false;
  return normalizeCajaId(session.cashBoxId) === bound;
}

/**
 * Devuelve el aviso para rechazar una sesión resuelta que **contradice** la
 * atadura de este terminal. `null` cuando la sesión pertenece a la caja atada,
 * cuando todavía no hay sesión que validar, y — clave — cuando no hay ninguna
 * caja atada: sin atadura no hay nada que contradecir, y negarse ahí dejaba sin
 * poder vender a una cajera sin `agents.cajaId` (que se escribe recién al
 * aprobar una apertura) con una sola sesión abierta. La ambigüedad real la
 * cubre el 409 de `GET /admin/sesiones/activa` (P1), que sí es ruidoso.
 */
export function describeSessionBindingMismatch(
  session: { cashBoxId?: string | null } | null,
  boundCajaId: string | null,
): string | null {
  if (!session) return null;
  const bound = normalizeCajaId(boundCajaId);
  if (!bound) return null;
  return isSessionBoundToCaja(session, bound) ? null : SESSION_NOT_BOUND_MESSAGE;
}

/**
 * Traduce los errores de resolución de sesión del backend a un mensaje
 * accionable para el cajero. 409 = ambigüedad (se incluye el detalle del
 * servidor con el conteo y las cajas cuando está disponible); 403 = la caja no
 * está asignada al agente. Cualquier otro error devuelve `null` para conservar
 * el manejo actual.
 */
export function describeSessionResolutionError(error: unknown): string | null {
  const status = readStatus(error);

  if (status === 409) {
    const detail = readServerMessage(error);
    return detail ? `${AMBIGUOUS_SESSION_MESSAGE} ${detail}` : AMBIGUOUS_SESSION_MESSAGE;
  }

  if (status === 403) {
    return CAJA_NOT_ASSIGNED_MESSAGE;
  }

  return null;
}
