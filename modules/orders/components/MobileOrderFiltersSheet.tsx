"use client";
import { useState } from "react";
import Sheet from "@/components/ui/sheet";
import { cn } from "@/modules/core/utils/ui";

export interface OrderFiltersValue {
  date_start: string;
  date_end: string;
  type_sale: string;
  status: string;
}

interface MobileOrderFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: OrderFiltersValue;
  onFiltersChange: (filters: OrderFiltersValue) => void;
  onReset: () => void;
}

const TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Todos" },
  { value: "local", label: "Local" },
  { value: "delivery", label: "Delivery" },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Todos" },
  { value: "Completed", label: "Completado" },
  { value: "Pending", label: "Pendiente" },
  { value: "Paid", label: "Pagado" },
  { value: "Cancelled", label: "Cancelado" },
  { value: "PipelineFailed", label: "Falló el proceso" },
];

/** A 44px segment of a filter group, announced as pressed (WCAG 4.1.2). */
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-xl px-2 text-[11px] font-black uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        active
          ? "bg-[#4A69BD] text-white shadow-sm"
          : "bg-slate-100 text-slate-500 active:bg-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

/**
 * The four filters of the order list on a phone (spec S6).
 *
 * At 390px the two date inputs and the two selects wrapped into three rows of
 * `min-w-[140px]` controls and pushed the list off the first screen. They live
 * here now, one 44px row each, and the surface keeps a single "Filtros" button
 * carrying the active-filter count.
 *
 * The values are the same four fields the desktop toolbar edits, so the query
 * and its behaviour do not change (spec S4).
 */
export default function MobileOrderFiltersSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onReset,
}: MobileOrderFiltersSheetProps) {
  const [local, setLocal] = useState<OrderFiltersValue>(filters);
  const [wasOpen, setWasOpen] = useState(open);

  // Opening always starts from the filters the list is applying. Adjusting the
  // state during render (not in an effect) keeps the 60 s order refetch from
  // wiping a draft the operator is still editing.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setLocal(filters);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros de órdenes"
      description="Fechas, tipo de entrega y estado"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onReset();
              onOpenChange(false);
            }}
            className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-red-500 transition-colors active:bg-red-50"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => {
              // Merge over the live filters so the scope keys the four visible
              // fields do not own (`id_group`, `id_pharmacy`) survive (S4).
              onFiltersChange({ ...filters, ...local });
              onOpenChange(false);
            }}
            className="flex min-h-12 flex-[2] items-center justify-center rounded-2xl bg-[#4A69BD] text-sm font-black text-white transition-colors active:bg-[#3d579c]"
          >
            Aplicar
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <SectionLabel>Fechas</SectionLabel>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-bold text-slate-500">Desde</span>
          <input
            type="date"
            value={local.date_start}
            onChange={(e) => setLocal((prev) => ({ ...prev, date_start: e.target.value }))}
            className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-700 outline-none focus:border-[#4A69BD] focus:ring-2 focus:ring-[#4A69BD]/20"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-bold text-slate-500">Hasta</span>
          <input
            type="date"
            value={local.date_end}
            onChange={(e) => setLocal((prev) => ({ ...prev, date_end: e.target.value }))}
            className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-700 outline-none focus:border-[#4A69BD] focus:ring-2 focus:ring-[#4A69BD]/20"
          />
        </label>

        <div className="mt-2 border-t border-slate-100 pt-2">
          <SectionLabel>Tipo de entrega</SectionLabel>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value || "all"}
              active={local.type_sale === option.value}
              onClick={() => setLocal((prev) => ({ ...prev, type_sale: option.value }))}
            >
              {option.label}
            </FilterChip>
          ))}
        </div>

        <div className="mt-2 border-t border-slate-100 pt-2">
          <SectionLabel>Estado del pedido</SectionLabel>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map((option) => (
            <FilterChip
              key={option.value || "all"}
              active={local.status === option.value}
              onClick={() => setLocal((prev) => ({ ...prev, status: option.value }))}
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
