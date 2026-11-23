"use client";
import RecordCard from "@/components/ui/record-card";

export interface StatisticsCardItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  controlled: boolean;
  cost: number;
  total: number;
}

interface StatisticsCardListProps {
  items: StatisticsCardItem[];
  isLoading: boolean;
  totalRevenue: number;
  /** The footer total only belongs here when there is at least one row. */
  showTotal: boolean;
  formatCurrency: (amount: number) => string;
}

function SkeletonCard() {
  return (
    <li className="animate-pulse rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="space-y-2">
        <div className="h-4 w-36 rounded bg-slate-100" />
        <div className="h-3 w-24 rounded bg-slate-100" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="h-8 rounded bg-slate-100" />
        <div className="h-8 rounded bg-slate-100" />
      </div>
    </li>
  );
}

/**
 * The "sales by product" list on a phone (spec S7).
 *
 * The six-column table below needs `min-w-225` (900px) and only fits by
 * scrolling sideways, which the mobile shell clips into a silent cut-off. Here
 * each product is one card: the name, the category and the three fields that
 * drive the decision (quantity, unit cost and net total) are always visible;
 * "Controlado" and the full category go behind the disclosure. The desktop
 * table stays exactly as it was from `lg` up (spec S4).
 */
export default function StatisticsCardList({
  items,
  isLoading,
  totalRevenue,
  showTotal,
  formatCurrency,
}: StatisticsCardListProps) {
  if (isLoading) {
    return (
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center text-sm font-bold text-slate-400">
        No se encontraron productos con estos filtros.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <RecordCard
            key={item.id}
            title={item.name}
            subtitle={item.category}
            fields={[
              { label: "Cantidad", value: item.quantity, emphasis: "strong" },
              { label: "Costo", value: formatCurrency(item.cost) },
              {
                label: "Total vendido (neto)",
                value: formatCurrency(item.total),
                emphasis: "strong",
              },
            ]}
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Controlado
                </dt>
                <dd className="truncate font-bold uppercase text-slate-600">
                  {item.controlled ? "Sí" : "No"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Categoría
                </dt>
                <dd className="truncate font-bold text-slate-600">{item.category}</dd>
              </div>
            </dl>
          </RecordCard>
        ))}
      </ul>

      {showTotal && (
        <p className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
          Total vendido (neto)
          <span className="truncate text-sm font-black normal-case tracking-normal text-slate-900">
            {formatCurrency(totalRevenue)}
          </span>
        </p>
      )}
    </div>
  );
}
