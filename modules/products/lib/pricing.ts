export const MAX_PROFIT_EXCLUSIVE = 100;

/**
 * Fallback VAT percent used only when no explicit value is available.
 * Mirrors the backend `shape::pricing::DEFAULT_VAT_PCT` (explicit inventory VAT
 * -> catalog VAT -> 0). An explicit `0` is a value and never falls back.
 */
export const DEFAULT_VAT_PCT = 0;

export function isValidProfit(profitPct: number): boolean {
  return Number.isFinite(profitPct) && profitPct >= 0 && profitPct < MAX_PROFIT_EXCLUSIVE;
}

export function sellingPrice(cost: number, profitPct: number, vatPct: number): number {
  if (!Number.isFinite(cost) || !isValidProfit(profitPct) || !Number.isFinite(vatPct)) {
    return NaN;
  }
  return (cost / (1 - profitPct / 100)) * (1 + vatPct / 100);
}

export function costFromPrice(price: number, profitPct: number, vatPct: number): number {
  if (!Number.isFinite(price) || !isValidProfit(profitPct) || !Number.isFinite(vatPct)) {
    return price;
  }
  return (price * (1 - profitPct / 100)) / (1 + vatPct / 100);
}

export interface TaxBreakdown {
  cost: number;
  saleNoVat: number;
  profit: number;
  iva: number;
  final: number;
}

/** Desglose de un precio final CON IVA (como lo guarda la app y lo cobra el POS):
 *  el IVA se extrae del precio, no se suma por encima. */
export function taxBreakdown(price: number, vatPct: number, basePrice?: number): TaxBreakdown {
  const final = Number.isFinite(price) ? price : 0;
  const vat = Number.isFinite(vatPct) ? vatPct : 0;
  const saleNoVat = final / (1 + vat / 100);
  const iva = final - saleNoVat;
  const cost = basePrice ?? saleNoVat;
  return { cost, saleNoVat, profit: saleNoVat - cost, iva, final };
}

/** Effective VAT percent: an explicit finite value wins, otherwise the documented default (0). */
export function effectiveVat(vatPct?: number | null): number {
  return typeof vatPct === "number" && Number.isFinite(vatPct) ? vatPct : DEFAULT_VAT_PCT;
}

/**
 * Parse a VAT form input. Blank -> `undefined` (absent, resolves to the default),
 * an explicit `"0"` -> `0` (a real value that must survive). Non-numeric -> `undefined`.
 */
export function parseVatInput(raw: string | number | null | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const text = String(raw).trim();
  if (text === "") return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Single authoritative FE derivation, parity-checked against the backend
 * `shape::pricing::derive`: `round2(base / (1 - profit/100) * (1 + vat/100) * (1 - discount/100))`.
 * Absent profit/discount -> 0; absent VAT -> {@link effectiveVat}.
 * Returns `undefined` when the base is absent (nothing to derive).
 */
export function derivePrice(
  base?: number,
  profitPct?: number,
  vatPct?: number | null,
  discountPct?: number | null,
): number | undefined {
  if (base === undefined || base === null || Number.isNaN(base)) return undefined;
  const gross = sellingPrice(base, profitPct ?? 0, effectiveVat(vatPct));
  const net = gross * (1 - (discountPct ?? 0) / 100);
  return Math.round(net * 100) / 100;
}

/** Bulk-import derivation: a thin wrapper over {@link derivePrice}. */
export function bulkSellingPrice(
  base?: number,
  profitPct?: number,
  vatPct?: number,
): number | undefined {
  return derivePrice(base, profitPct, vatPct);
}

/**
 * Price the register charges for a product: the persisted listing `price` (USD).
 * The panel must render exactly this value so it equals `fiscalUnitPriceBs(price, rate)`.
 */
export function displayedChargePrice(med?: { price?: number | null } | null): number {
  const price = med?.price;
  return typeof price === "number" && Number.isFinite(price) ? price : 0;
}

