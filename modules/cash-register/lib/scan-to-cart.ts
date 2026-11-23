/**
 * Reglas de cantidad del flujo "escanear para vender" (`odd/tasks/scan-to-cart.md`,
 * spec S5): la cantidad se acota al stock disponible de la sucursal, se puede
 * escribir o mover de a un paso, y una cantidad cero no llega nunca al carrito.
 *
 * Vive aparte del componente y del store porque es la parte que se puede probar
 * sin cámara ni navegador. El carrito NO se reimplementa acá: `addMedication`
 * sigue siendo el único que escribe, y este módulo sólo decide qué número se le
 * pasa para que no falle después, en el cobro.
 *
 * "Disponible" es stock menos lo que ya está cargado para ese mismo producto: al
 * acumular dos escaneos del mismo código, el tope de la segunda pasada es el
 * stock que quedó, no el original (`addMedication` rechazaría la suma).
 */

/** Convierte cualquier entrada en un entero ≥ 0; nunca devuelve `NaN`. */
function toCount(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Unidades que todavía se pueden sumar a la venta para este producto. */
export function remainingStock(stock: number, inCart: number): number {
  return Math.max(0, toCount(stock) - toCount(inCart));
}

/** Cantidad con la que abre el control: 1 si hay algo para vender, 0 si no. */
export function defaultScanQuantity(remaining: number): number {
  return toCount(remaining) > 0 ? 1 : 0;
}

/**
 * Interpreta lo tipeado en el input numérico: vacío o ilegible es 0 (el botón
 * queda deshabilitado con su explicación, en vez de agregar 1 por sorpresa) y
 * por encima del stock se recorta al stock.
 */
export function parseScanQuantity(raw: string, remaining: number): number {
  const max = toCount(remaining);
  const digits = typeof raw === "string" ? raw.trim() : "";
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(max, parsed);
}

/** Un paso de − / + sobre la cantidad actual, siempre dentro de 0..disponible. */
export function stepScanQuantity(current: number, delta: number, remaining: number): number {
  const max = toCount(remaining);
  const step = typeof delta === "number" && Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const next = toCount(current) + step;
  return Math.min(max, Math.max(0, next));
}

/** Motivos por los que "Agregar a la venta" queda deshabilitado (`null` = se puede). */
export type ScanAddIssue = "out-of-stock" | "zero" | "over-stock";

export function scanAddIssue(quantity: number, remaining: number): ScanAddIssue | null {
  const max = toCount(remaining);
  const qty = toCount(quantity);
  if (max <= 0) return "out-of-stock";
  if (qty <= 0) return "zero";
  if (qty > max) return "over-stock";
  return null;
}

/** Texto en español de ese motivo, para mostrarlo al lado del botón. */
export function scanAddIssueMessage(issue: ScanAddIssue | null, remaining: number): string | null {
  if (issue === null) return null;
  const max = toCount(remaining);
  if (issue === "out-of-stock") return "Este producto no tiene stock disponible en la sucursal.";
  if (issue === "zero") return "Elegí al menos 1 unidad para agregarla a la venta.";
  return `Sólo podés agregar ${max} ${max === 1 ? "unidad" : "unidades"} más de este producto.`;
}

/**
 * Unidades del producto que quedan en la venta después de agregar. El acumulado
 * lo sigue haciendo `addMedication`; esto es sólo para mostrar el total y para
 * calcular el disponible del siguiente escaneo.
 */
export function cartQuantityAfterAdd(inCart: number, quantity: number): number {
  return toCount(inCart) + toCount(quantity);
}
