/**
 * Contrato del ajuste de stock desde el escáner (`odd/tasks/scanner-stock-adjust.md`,
 * T2 en el backend, consumido en T3/T4 acá).
 *
 * `POST /admin/inventory/adjust` recibe `{ pharmacy_id, bar_code, delta, reason? }`
 * y responde:
 *
 *  * 200 → `{ bar_code, stock_previo, stock_nuevo, movimiento_id }`, **envuelto
 *    en el `ApiResponse` que usa todo el backend** (`{ success, data, error }`,
 *    `Backend-administrativo: src/features/inventory_movements/src/adapters/present.rs:3-24`).
 *    Se acepta también sin envolver para no depender del envoltorio.
 *  * 403 → el agente no tiene el permiso `Ajustar stock desde escáner`.
 *  * 404 → el código no tiene inventario en esa farmacia.
 *  * 409 → el stock se movió entre la lectura y la escritura (compare-and-set).
 *  * 422 → `delta` es 0, o el ajuste dejaría el stock negativo.
 *  * 500 → fallo de base (el único error de servidor real).
 *
 * Las funciones de acá son puras (sin red ni React) para poder probar el mapeo
 * de status y el desarrollo del 200 con `node --test`.
 */

export const STOCK_ADJUST_PATH = "/admin/inventory/adjust";

/**
 * Permiso que habilita el ajuste (T4/S6). Es el literal que el administrador de
 * farmacias asigna y el string **exacto** que exige el backend
 * (`Backend-administrativo: src/features/inventory_movements/src/domain/ajuste_stock.rs:20,113`):
 * comparar en minúsculas, recortado o por prefijo mostraría el control a alguien
 * a quien el endpoint le va a responder 403.
 */
export const STOCK_ADJUST_PERMIT = "Ajustar stock desde escáner";

export interface StockAdjustResult {
  barCode: string;
  stockPrevio: number;
  stockNuevo: number;
  movimientoId: string;
}

export type StockAdjustOutcome =
  | { status: "adjusted"; result: StockAdjustResult }
  | { status: "conflict"; message: string }
  | { status: "forbidden"; message: string }
  | { status: "not-found"; message: string }
  | { status: "rejected"; message: string }
  | { status: "error"; message: string };

/** ¿La sesión tiene el permiso de ajuste? Comparación exacta contra el backend. */
export function hasStockAdjustPermit(permits: readonly string[] | null | undefined): boolean {
  if (!Array.isArray(permits)) return false;
  return permits.some((permit) => permit === STOCK_ADJUST_PERMIT);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Motivo que informó el backend: `error` (ApiResponse) o `message` (proxy/axios). */
export function stockAdjustErrorMessage(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== "object") return fallback;
  const body = raw as Record<string, unknown>;
  const direct = text(body.error) ?? text(body.message) ?? text(body.detail);
  if (direct) return direct;
  // El proxy y algunos handlers anidan el motivo un nivel más abajo.
  for (const key of ["data", "response", "body"]) {
    const nested = body[key];
    if (nested && typeof nested === "object") {
      const inner = stockAdjustErrorMessage(nested, "");
      if (inner) return inner;
    }
  }
  return fallback;
}

function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Desenvuelve el 200. Devuelve `null` si no trae el stock nuevo: sin eso no hubo ajuste. */
export function unwrapStockAdjustPayload(raw: unknown): StockAdjustResult | null {
  if (!raw || typeof raw !== "object") return null;
  const envelope = raw as Record<string, unknown>;
  const body =
    envelope.data && typeof envelope.data === "object"
      ? (envelope.data as Record<string, unknown>)
      : envelope;

  const barCode = text(body.bar_code ?? body.barCode);
  const stockPrevio = finite(body.stock_previo ?? body.stockPrevio);
  const stockNuevo = finite(body.stock_nuevo ?? body.stockNuevo);
  const movimientoId = text(body.movimiento_id ?? body.movimientoId);
  if (!barCode || stockPrevio === null || stockNuevo === null || !movimientoId) return null;

  return { barCode, stockPrevio, stockNuevo, movimientoId };
}

/** Traduce un rechazo del endpoint a lo que la pantalla le puede mostrar al operador. */
export function adjustFailure(status: number, raw: unknown): StockAdjustOutcome {
  const fallback = (() => {
    switch (status) {
      case 403:
        return "No tenés el permiso para ajustar stock desde el escáner.";
      case 404:
        return "Este código no tiene inventario en esta farmacia.";
      case 409:
        return "El stock cambió mientras mirabas el producto. Volvé a escanear el código y revisá el stock.";
      case 422:
        return "El ajuste no se aplicó: la cantidad no es válida o dejaría el stock en negativo.";
      default:
        return "No se pudo ajustar el stock. Revisá la conexión e intentá de nuevo.";
    }
  })();

  const message = stockAdjustErrorMessage(raw, fallback);
  switch (status) {
    case 403:
      return { status: "forbidden", message };
    case 404:
      return { status: "not-found", message };
    case 409:
      return { status: "conflict", message };
    case 422:
      return { status: "rejected", message };
    default:
      return { status: "error", message };
  }
}
