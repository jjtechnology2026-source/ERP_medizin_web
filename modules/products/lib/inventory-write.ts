/**
 * Pure inventory-write helpers for product save.
 *
 * No React, no store imports, no side effects. They encode the `saveMedicine`
 * decision table from the product-price-update design:
 *
 *   stockDelta | pricing changed? | lot changed? | Action
 *   ≠ 0        | any              | any          | write (additive delta + price fields)
 *   0          | yes              | any          | write (stock 0 + price fields, omit lote)
 *   0          | no               | yes          | skip
 *   0          | no               | no           | skip
 *
 * A lot change alone can never force a write: `lote` is not part of the pricing
 * snapshot, so a lot-only save resolves to `{ stockDelta: 0, pricingChanged: false }`
 * and skips.
 */

export interface PricingSnapshot {
  price?: number | null;
  minimum?: number | null;
  discount?: number | null;
  basePrice?: number | null;
  profitPercentage?: number | null;
}

/** The item shape accepted by `productsService.increaseInventory`. */
export interface InventoryIncreaseItem {
  bar_code: string;
  stock: number;
  price: number;
  minimum: number;
  discount?: number;
  base_price?: number;
  profit_percentage?: number;
  lote?: string;
  fecha_vencimiento_lote?: string;
}

/** Minimal structural view of a Medication as seen by the MQTT echo handler. */
export interface EchoMedication {
  barCode: string;
  stock: number;
  quantity: number;
  price: number;
}

/** Duration (ms) after a local optimistic mutation during which an echo is ignored. */
export const ECHO_WINDOW_MS = 5000;

function normNum(value: number | null | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function normDelta(value: number | null | undefined): number {
  return normNum(value) ?? 0;
}

/** Pricing present on a genuinely new product (`minimum` counts only when > 0). */
function hasPricing(submitted: PricingSnapshot): boolean {
  if (normDelta(submitted.price) > 0) return true;
  if (normDelta(submitted.minimum) > 0) return true;
  if (normNum(submitted.discount) !== undefined) return true;
  if (normNum(submitted.basePrice) !== undefined) return true;
  if (normNum(submitted.profitPercentage) !== undefined) return true;
  return false;
}

/** Absolute-value comparison against the server-resolved existing item (W1: `minimum` participates). */
function pricingChanged(submitted: PricingSnapshot, existing: PricingSnapshot): boolean {
  if (normDelta(submitted.price) !== normDelta(existing.price)) return true;
  if (normDelta(submitted.minimum) !== normDelta(existing.minimum)) return true;
  if (normNum(submitted.discount) !== normNum(existing.discount)) return true;
  if (normNum(submitted.basePrice) !== normNum(existing.basePrice)) return true;
  if (normNum(submitted.profitPercentage) !== normNum(existing.profitPercentage)) return true;
  return false;
}

/**
 * Decide whether a save must run the price-carrying `increaseInventory` write.
 *
 * @param stockDelta additive stock change (0 for a price-only edit)
 * @param submitted  absolute pricing values from the form
 * @param existing   server-resolved item for an existing product; null/undefined
 *                   for a genuinely new product (then `hasPricing` applies)
 */
export function shouldWriteInventory(params: {
  stockDelta: number;
  submitted: PricingSnapshot;
  existing?: PricingSnapshot | null;
}): boolean {
  if (normDelta(params.stockDelta) !== 0) return true;
  if (params.existing) return pricingChanged(params.submitted, params.existing);
  return hasPricing(params.submitted);
}

/**
 * Build the `increaseInventory` item for a save.
 *
 * `stock` is always the additive delta. `lote`/`fecha_vencimiento_lote` are
 * forwarded only for a positive delta, so a price-only edit never attaches a lot.
 */
export function buildIncreaseItem(
  medicine: {
    barCode?: string;
    price?: number | null;
    minimum?: number | null;
    discount?: number | null;
    basePrice?: number | null;
    profitPercentage?: number | null;
    lote?: string;
    fechaVencimiento?: string;
  },
  stockDelta: number
): InventoryIncreaseItem {
  const delta = normDelta(stockDelta);
  const item: InventoryIncreaseItem = {
    bar_code: medicine.barCode || "",
    stock: delta,
    price: normDelta(medicine.price),
    minimum: normDelta(medicine.minimum),
  };

  const discount = normNum(medicine.discount);
  if (discount !== undefined) item.discount = discount;

  const basePrice = normNum(medicine.basePrice);
  if (basePrice !== undefined) item.base_price = basePrice;

  const profit = normNum(medicine.profitPercentage);
  if (profit !== undefined) item.profit_percentage = profit;

  if (delta > 0) {
    const lote = typeof medicine.lote === "string" ? medicine.lote.trim() : "";
    if (lote) item.lote = lote;
    const expiry =
      typeof medicine.fechaVencimiento === "string" ? medicine.fechaVencimiento.trim() : "";
    if (expiry) item.fecha_vencimiento_lote = expiry;
  }

  return item;
}

/**
 * Merge an insert/update echo into the local inventory item.
 *
 * An echo arriving within {@link ECHO_WINDOW_MS} of a local optimistic mutation
 * applies price/metadata but MUST NOT add the stock delta again. Outside the
 * window (or with no recorded mutation) the delta is additive as before.
 */
export function mergeEcho<T extends EchoMedication>(params: {
  existing?: T;
  incoming: T;
  lastMutationAt?: number;
  now: number;
}): T {
  const withinWindow =
    params.lastMutationAt !== undefined &&
    params.now - params.lastMutationAt <= ECHO_WINDOW_MS;

  const addAmount =
    normDelta(params.incoming.quantity) > 0
      ? normDelta(params.incoming.quantity)
      : normDelta(params.incoming.stock);

  const baseStock = params.existing?.stock ?? 0;
  const stock = withinWindow ? baseStock : baseStock + addAmount;
  const price =
    params.incoming.price > 0
      ? params.incoming.price
      : params.existing?.price ?? params.incoming.price;

  return { ...params.existing, ...params.incoming, stock, price } as T;
}
