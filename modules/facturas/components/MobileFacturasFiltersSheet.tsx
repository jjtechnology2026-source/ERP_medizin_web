"use client";
import { useState } from "react";
import { HiOutlineCalendar } from "react-icons/hi";
import Sheet from "@/components/ui/sheet";
import { cn } from "@/modules/core/utils/ui";
import {
  FACTURA_DATE_PRESETS,
  facturaDatePresetRange,
  isFacturaPresetApplied,
  type FacturaDatePreset,
} from "../lib/date-presets";
import type { FacturaEstadoFilter } from "../types";

export interface FacturaFiltersDraft {
  desde: string;
  hasta: string;
  estado: FacturaEstadoFilter;
}

interface MobileFacturasFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: FacturaFiltersDraft;
  onApply: (draft: FacturaFiltersDraft) => void;
  onReset: () => void;
}

const ESTADO_OPTIONS: ReadonlyArray<{ id: FacturaEstadoFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "con-nc", label: "Con nota de crédito" },
  { id: "sin-nc", label: "Sin nota de crédito" },
];

/** A 44px row of a filter group, announced as pressed (WCAG 4.1.2). */
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
          ? "bg-[#1E3A5F] text-white shadow-sm"
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
 * The single filter surface of the invoice list on a phone (spec S6).
 *
 * The two native date inputs and the "sin tope" label used to sit inline next
 * to the search field, where a 390px screen cannot hold them. Here they get a
 * 44px row each plus four shortcuts, and the surface keeps a search field and
 * one button with an active-filter count.
 *
 * The bounds are local calendar days (`lib/date-presets.ts`), and the inputs are
 * 16px so iOS does not zoom on focus (spec S8).
 */
export default function MobileFacturasFiltersSheet({
  open,
  onOpenChange,
  draft,
  onApply,
  onReset,
}: MobileFacturasFiltersSheetProps) {
  const [local, setLocal] = useState<FacturaFiltersDraft>(draft);
  const [wasOpen, setWasOpen] = useState(open);

  // The sheet is a draft until `Aplicar`: opening it always starts from what the
  // list is showing. Adjusting the state during render (instead of in an effect)
  // keeps a background refetch of the invoice list from wiping the bounds the
  // operator is still editing.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setLocal(draft);
  }

  const applyPreset = (preset: FacturaDatePreset) => {
    const range = facturaDatePresetRange(preset);
    setLocal((prev) => ({ ...prev, desde: range.desde, hasta: range.hasta }));
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros de facturas"
      description="Rango de fechas y estado del documento"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onReset();
              onOpenChange(false);
            }}
            className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-500 transition-colors active:bg-slate-100"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(local);
              onOpenChange(false);
            }}
            className="flex min-h-12 flex-[2] items-center justify-center rounded-2xl bg-[#1E3A5F] text-sm font-black text-white transition-colors active:bg-[#16293f]"
          >
            Aplicar
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <SectionLabel>Atajos</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {FACTURA_DATE_PRESETS.map((preset) => (
            <FilterChip
              key={preset.id}
              active={isFacturaPresetApplied(preset.id, local.desde, local.hasta)}
              onClick={() => applyPreset(preset.id)}
            >
              {preset.label}
            </FilterChip>
          ))}
        </div>

        <div className="mt-2 border-t border-slate-100 pt-2">
          <SectionLabel>Fechas</SectionLabel>
        </div>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-bold text-slate-500">Desde</span>
          <input
            type="date"
            value={local.desde}
            onChange={(e) => setLocal((prev) => ({ ...prev, desde: e.target.value }))}
            className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-700 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-bold text-slate-500">Hasta</span>
          <input
            type="date"
            value={local.hasta}
            onChange={(e) => setLocal((prev) => ({ ...prev, hasta: e.target.value }))}
            className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-700 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </label>
        <p className="flex items-start gap-1.5 px-1 text-[11px] font-bold leading-snug text-slate-400">
          <HiOutlineCalendar size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          Sin fecha «hasta» se listan todas las facturas posteriores a la fecha inicial.
        </p>

        <div className="mt-2 border-t border-slate-100 pt-2">
          <SectionLabel>Estado</SectionLabel>
        </div>
        <div className="flex flex-col gap-2">
          {ESTADO_OPTIONS.map((option) => (
            <FilterChip
              key={option.id}
              active={local.estado === option.id}
              onClick={() => setLocal((prev) => ({ ...prev, estado: option.id }))}
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
