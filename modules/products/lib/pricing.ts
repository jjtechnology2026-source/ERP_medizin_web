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

export function bulkSellingPrice(
  base?: number,
  profitPct?: number,
  vatPct?: number,
): number | undefined {
  if (base === undefined || Number.isNaN(base)) return undefined;
  return Math.round(sellingPrice(base, profitPct ?? 0, vatPct ?? 16) * 100) / 100;
}

