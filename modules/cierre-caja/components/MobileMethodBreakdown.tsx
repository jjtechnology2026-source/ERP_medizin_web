"use client";

import { cn } from "@/modules/core/utils/ui";
import type { CierreMethodBreakdownRow } from "@/modules/cash-register/lib/cierre-caja";
import {
  METHOD_BG,
  METHOD_COLORS,
  METHOD_ICONS,
  METHOD_LABELS,
} from "./payment-method";

interface MobileMethodBreakdownProps {
  rows: CierreMethodBreakdownRow[];
  /** Total esperado fiscal del backend, que se muestra como cierre del bloque. */
  authoritativeTotal: number;
}

/** Diferencia con signo; cero se muestra sin signo para que no parezca un sobrante. */
function formatDifference(difference: number): string {
  if (difference === 0) return "0.00";
  return `${difference > 0 ? "+" : ""}${difference.toFixed(2)}`;
}

/**
 * Desglose por metodo de pago compuesto para un telefono (T6).
 *
 * The four-column table of the desktop composition puts four numbers in ~73px
 * each at 390px, which is unreadable. On a phone each method is one block with
 * its three numbers stacked: the difference headline on the row, then the
 * expected and the counted amount underneath. The difference only takes a color
 * when it is not zero — a green `+0.00` on every row reads as "everything is
 * fine" even when another row is short.
 *
 * Desktop keeps the `grid-cols-4` table it always had (spec S4); this component
 * only renders below `lg`.
 */
export default function MobileMethodBreakdown({
  rows,
  authoritativeTotal,
}: MobileMethodBreakdownProps) {
  return (
    <div className="lg:hidden">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-bold text-slate-400">
          Sin movimientos ni conteo registrados.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.key}
              className="rounded-2xl border border-slate-100 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-xl",
                      METHOD_BG[row.key],
                      METHOD_COLORS[row.key],
                    )}
                    aria-hidden="true"
                  >
                    {METHOD_ICONS[row.key]}
                  </span>
                  <span className="truncate text-sm font-black text-slate-700">
                    {METHOD_LABELS[row.key]}
                  </span>
                </div>

                {/* The one number that decides: signed difference, colored only
                    when it is not zero (never color-only: it is also signed). */}
                <span
                  className={cn(
                    "shrink-0 font-mono text-base font-black tabular-nums",
                    row.difference === 0 ? "text-slate-400" : "text-red-500",
                  )}
                >
                  {formatDifference(row.difference)}
                </span>
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-50 pt-2">
                <div className="min-w-0">
                  <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Esperado
                  </dt>
                  <dd className="font-mono text-sm font-bold tabular-nums text-slate-600">
                    {row.expected.toFixed(2)}
                  </dd>
                </div>
                <div className="min-w-0 text-right">
                  <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Contado
                  </dt>
                  <dd className="font-mono text-sm font-black tabular-nums text-slate-900">
                    {row.counted.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-3">
        <span className="text-xs font-bold text-slate-500">
          Total esperado fiscal
        </span>
        <span className="font-mono text-base font-black tabular-nums text-slate-800">
          {authoritativeTotal.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
