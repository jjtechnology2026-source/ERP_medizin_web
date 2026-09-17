export const MAX_PROFIT_EXCLUSIVE = 100;

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

export function bulkSellingPrice(
  base?: number,
  profitPct?: number,
  vatPct?: number,
): number | undefined {
  if (base === undefined || Number.isNaN(base)) return undefined;
  return Math.round(sellingPrice(base, profitPct ?? 0, vatPct ?? 16) * 100) / 100;
}

