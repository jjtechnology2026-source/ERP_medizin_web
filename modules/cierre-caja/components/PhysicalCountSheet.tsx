"use client";

import Sheet from "@/components/ui/sheet";
import { cn } from "@/modules/core/utils/ui";
import { COUNT_FIELDS, type PhysicalCount } from "../lib/physical-count";

interface PhysicalCountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: PhysicalCount;
  onChange: (field: keyof PhysicalCount, value: string) => void;
  differenceVes: number;
  differenceUsd: number;
}

function signed(amount: number): string {
  if (amount === 0) return "0.00";
  return `${amount > 0 ? "+" : ""}${amount.toFixed(2)}`;
}

/**
 * Conteo fisico del turno en un telefono (T6).
 *
 * Seven inputs on the surface pushed the phone screen to nine visible controls
 * (spec S6) and each one opened an alphabetic keyboard: `type="number"` without
 * `inputMode` gives iOS a keypad with no decimal separator. Here the count is
 * one tap away, the fields are a single high-contrast column of 48px rows with
 * `inputmode="decimal"`, 16px text so iOS does not zoom on focus (spec S8), and
 * the running difference sits next to the numbers instead of at the end of the
 * page.
 *
 * Nothing about the closure math changes: the same `physicalCount` state feeds
 * `requestCloseSession`.
 */
export default function PhysicalCountSheet({
  open,
  onOpenChange,
  counts,
  onChange,
  differenceVes,
  differenceUsd,
}: PhysicalCountSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Conteo físico"
      description="Ingresa lo contado en caja de cada método."
      footer={
        <div className="flex flex-col gap-2">
          <DifferenceLine label="Diferencia Bs" amount={differenceVes} />
          <DifferenceLine label="Diferencia USD" amount={differenceUsd} />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-12 rounded-2xl bg-[#0057FF] text-sm font-black text-white transition-colors active:bg-[#0046CC]"
          >
            Listo
          </button>
        </div>
      }
    >
      {/* One column, label on the left and a big right-aligned number: at a
          counter the cashier reads the method and types without hunting. */}
      <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
        {COUNT_FIELDS.map(({ field, label }) => (
          <li
            key={field}
            className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 last:border-b-0"
          >
            <label
              htmlFor={`physical-count-${field}`}
              className="min-w-0 text-[13px] font-black leading-tight text-slate-700"
            >
              {label}
            </label>
            <input
              id={`physical-count-${field}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={counts[field] || ""}
              onChange={(event) => onChange(field, event.target.value)}
              className="h-12 w-32 shrink-0 rounded-xl border border-slate-300 bg-white px-3 text-right font-mono text-base font-black tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function DifferenceLine({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-sm font-black tabular-nums",
          amount === 0 ? "text-slate-400" : "text-red-500",
        )}
      >
        {signed(amount)}
      </span>
    </div>
  );
}
