import { daysAgoStr, localDateStr } from "@/modules/core/utils/date";

/** The date shortcuts of the invoices filter sheet on a phone (T5). */
export type FacturaDatePreset = "today" | "yesterday" | "week" | "month";

export interface FacturaDateRange {
  /** `YYYY-MM-DD` local calendar day. Empty means "no lower bound". */
  desde: string;
  /** `YYYY-MM-DD` local calendar day. Empty means "no upper bound". */
  hasta: string;
}

/** What the sheet renders, in the order it renders it. */
export const FACTURA_DATE_PRESETS: ReadonlyArray<{
  id: FacturaDatePreset;
  label: string;
}> = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mes" },
];

/** Monday of the week `now` falls in, as a local calendar day. */
function mondayOfWeek(now: Date): Date {
  // `getDay()` is Sunday-based and the pharmacy counts the week from Monday.
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
}

/**
 * The range one preset applies to the invoice list.
 *
 * Only `yesterday` closes the upper bound: its end is already in the past by
 * construction, so it cannot hide a document that was just emitted. Every other
 * preset leaves `hasta` empty on purpose — a ceiling computed from the PC clock
 * hides the newest invoice when that clock runs behind, which is exactly what
 * `modules/core/utils/date.ts` warns about.
 *
 * Local calendar days, never `toISOString()`: in Caracas (UTC−4) a UTC-based
 * range past 20:00 already points at tomorrow.
 */
export function facturaDatePresetRange(
  preset: FacturaDatePreset,
  now: Date = new Date(),
): FacturaDateRange {
  switch (preset) {
    case "today":
      return { desde: localDateStr(now), hasta: "" };
    case "yesterday": {
      const day = daysAgoStr(1, now);
      return { desde: day, hasta: day };
    }
    case "week":
      return { desde: localDateStr(mondayOfWeek(now)), hasta: "" };
    case "month":
      return {
        desde: localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
        hasta: "",
      };
  }
}

/** `true` when the stored bounds are exactly the ones the preset would apply. */
export function isFacturaPresetApplied(
  preset: FacturaDatePreset,
  desde: string,
  hasta: string,
  now: Date = new Date(),
): boolean {
  const range = facturaDatePresetRange(preset, now);
  return range.desde === desde && range.hasta === hasta;
}
