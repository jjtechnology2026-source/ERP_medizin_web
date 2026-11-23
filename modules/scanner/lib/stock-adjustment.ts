/**
 * Cálculo del ajuste de stock desde el escáner (`odd/tasks/scanner-stock-adjust.md`,
 * T3 + S5).
 *
 * Todo lo que se puede decidir sin red ni DOM vive acá, en funciones puras:
 *
 *  * el **delta** sale del campo editable (un entero con signo: positivo suma,
 *    negativo resta) o de los botones − / +, que mueven ese mismo valor de a una
 *    unidad;
 *  * el **tope** contra el stock ya leído: restar más de lo que hay se recorta y
 *    se explica, y la confirmación queda deshabilitada. No se manda el delta a
 *    ciegas para que el único defensor sea el 422 del backend (S5).
 *
 * `clamped` significa "lo que escribió el operador no entra en el stock", así que
 * el valor recortado **no** se confirma solo: tiene que volver a escribirlo (o
 * ajustarlo con los botones) y ver el número corregido antes de mandarlo.
 */

/** Tope de cordura del campo: un dedo de más no dispara un ajuste absurdo. */
export const MAX_ADJUSTMENT_DELTA = 1_000_000;

/** Dirección de un toque en los botones − / +. */
export type AdjustDirection = 1 | -1;

export type TypedDelta =
  | { ok: true; delta: number }
  | { ok: false; reason: "empty" | "not-numeric" | "out-of-range" };

/** Entero con signo opcional y sin separadores: lo único que el campo acepta. */
const INTEGER_TEXT = /^-?\d+$/;

/** Lee el valor del campo. `"0"` es un número válido, pero no un ajuste. */
export function parseTypedDelta(raw: string): TypedDelta {
  const text = (raw ?? "").trim();
  if (!text || text === "-") return { ok: false, reason: "empty" };
  if (!INTEGER_TEXT.test(text)) return { ok: false, reason: "not-numeric" };

  const delta = Number(text);
  if (!Number.isSafeInteger(delta) || Math.abs(delta) > MAX_ADJUSTMENT_DELTA) {
    return { ok: false, reason: "out-of-range" };
  }
  return { ok: true, delta };
}

/** Un toque de − / + sobre el valor actual del campo. */
export function stepDelta(delta: number, direction: AdjustDirection): number {
  const base = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const next = base + direction;
  return Object.is(next, -0) ? 0 : next;
}

export interface ClampedDelta {
  /** Delta efectivo, nunca menor que `-availableStock`. */
  delta: number;
  /** `true` cuando el operador pidió restar más de lo que hay. */
  clamped: boolean;
  /** Stock contra el que se recortó (0 si el leído no es un número usable). */
  availableStock: number;
}

/** Recorta el delta para que el stock resultante no quede negativo (S5). */
export function clampDeltaToStock(delta: number, stock: number): ClampedDelta {
  const availableStock = Number.isFinite(stock) && stock > 0 ? Math.trunc(stock) : 0;
  // `-0` se normaliza a `0`: un delta `-0` se enviaría como 0 y el backend lo
  // rechaza como "no es un movimiento".
  const minDelta = availableStock === 0 ? 0 : -availableStock;
  if (delta < minDelta) return { delta: minDelta, clamped: true, availableStock };
  return { delta, clamped: false, availableStock };
}

/** Copia del efecto del ajuste: "Sumar 3 unidades" / "Quitar 3 unidades". */
export function describeDelta(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return "Sin cambios";
  const units = Math.abs(Math.trunc(delta));
  const noun = units === 1 ? "unidad" : "unidades";
  return delta > 0 ? `Sumar ${units} ${noun}` : `Quitar ${units} ${noun}`;
}

export interface AdjustmentDraft {
  /** Delta que se mandaría al backend (ya recortado contra el stock). */
  delta: number;
  clamped: boolean;
  /** Stock leído del inventario (o el que dejó el ajuste anterior). */
  previousStock: number;
  /** Stock que quedaría: `previousStock + delta`, nunca negativo. */
  resultStock: number;
  /** `true` sólo si hay un ajuste real que mandar y no se recortó nada. */
  canConfirm: boolean;
  /** Explica el recorte o por qué no se puede confirmar; `null` si todo bien. */
  notice: string | null;
}

/**
 * Estado completo del control a partir del texto del campo y del stock leído.
 * Lo que no se puede confirmar no se confirma: nunca se escribe "en silencio".
 */
export function buildAdjustment(raw: string, stock: number): AdjustmentDraft {
  const { availableStock } = clampDeltaToStock(0, stock);
  const invalid = (notice: string): AdjustmentDraft => ({
    delta: 0,
    clamped: false,
    previousStock: availableStock,
    resultStock: availableStock,
    canConfirm: false,
    notice,
  });

  const parsed = parseTypedDelta(raw);
  if (!parsed.ok) {
    switch (parsed.reason) {
      case "empty":
        return invalid("Escribí cuántas unidades sumar o restar.");
      case "out-of-range":
        return invalid("Esa cantidad es demasiado grande.");
      default:
        return invalid("La cantidad tiene que ser un número entero.");
    }
  }

  const { delta, clamped } = clampDeltaToStock(parsed.delta, availableStock);

  if (clamped) {
    return {
      delta,
      clamped: true,
      previousStock: availableStock,
      resultStock: 0,
      canConfirm: false,
      notice:
        availableStock === 0
          ? "Este producto no tiene stock: sólo se puede sumar."
          : `Sólo hay ${availableStock} ${availableStock === 1 ? "unidad" : "unidades"} en stock: no se puede quitar más.`,
    };
  }

  if (delta === 0) return invalid("Escribí cuántas unidades sumar o restar.");

  return {
    delta,
    clamped: false,
    previousStock: availableStock,
    resultStock: Math.max(0, availableStock + delta),
    canConfirm: true,
    notice: null,
  };
}
