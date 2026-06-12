import { useCurrencyStore } from "@/modules/core/store/currency.store";

export function useFormatCurrency() {
  const { isDollar, getEffectiveRate } = useCurrencyStore();

  function format(amountInUsd: number): string {
    if (isDollar) {
      return `$ ${amountInUsd.toFixed(2)}`;
    }
    const rate = getEffectiveRate();
    return `Bs ${(amountInUsd * rate).toFixed(2)}`;
  }

  function formatWithRate(
    amountInUsd: number,
    options?: { showRate?: boolean }
  ): { display: string; rate: number } {
    const rate = getEffectiveRate();
    const display = format(amountInUsd);
    return { display, rate };
  }

  function convertToBs(amountInUsd: number): number {
    return amountInUsd * getEffectiveRate();
  }

  function convertFromBs(amountInBs: number): number {
    const rate = getEffectiveRate();
    return rate > 0 ? amountInBs / rate : 0;
  }

  function parseInput(value: string): number {
    const cleaned = value.replace(",", ".");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  return { format, formatWithRate, convertToBs, convertFromBs, parseInput };
}
