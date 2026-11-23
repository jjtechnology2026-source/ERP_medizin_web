"use client";
import { useState } from "react";
import {
  HiOutlineCalendar,
  HiOutlineDocumentText,
  HiOutlineFilter,
  HiOutlineSearch,
} from "react-icons/hi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useIsMobileViewport } from "@/modules/core/hooks/useIsMobileViewport";
import { daysAgoStr } from "@/modules/core/utils/date";
import { useFacturas } from "./hooks/useFacturas";
import FacturasTable from "./components/FacturasTable";
import MobileFacturasFiltersSheet, {
  type FacturaFiltersDraft,
} from "./components/MobileFacturasFiltersSheet";
import type { FacturaEstadoFilter, FacturaFilters } from "./types";

/** `YYYY-MM-DD` -> `DD/MM/YYYY` for the surface summary only. */
function shortDate(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export default function FacturasFeature() {
  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId || "";
  const isMobile = useIsMobileViewport();

  const [search, setSearch] = useState("");
  // The 30-day window the screen opens with. It is not an operator choice, so it
  // never counts as an active filter.
  const [defaultDesde] = useState(() => daysAgoStr(30));
  const [fechaDesde, setFechaDesde] = useState(defaultDesde);
  // Sin "hasta" por defecto: el backend no aplica límite superior cuando la fecha
  // no viene, así que las facturas recién emitidas se ven siempre. Un "hasta"
  // calculado con el reloj de la PC las escondería si ese reloj está atrasado.
  const [fechaHasta, setFechaHasta] = useState("");
  const [estado, setEstado] = useState<FacturaEstadoFilter>("all");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // The state filter is only reachable from the phone sheet, so desktop keeps
  // listing every document, exactly as it does today (spec S4).
  const effectiveEstado: FacturaEstadoFilter = isMobile ? estado : "all";

  const filtros: FacturaFilters = {
    pharmacy_id: pharmacyId,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(fechaDesde ? { fecha_desde: fechaDesde } : {}),
    ...(fechaHasta ? { fecha_hasta: fechaHasta } : {}),
  };

  const { facturas, isLoading, refetch } = useFacturas(filtros);

  const draft: FacturaFiltersDraft = {
    desde: fechaDesde,
    hasta: fechaHasta,
    estado,
  };

  const activeFilterCount =
    (fechaDesde !== defaultDesde ? 1 : 0) +
    (fechaHasta ? 1 : 0) +
    (estado !== "all" ? 1 : 0);

  const estadoLabel =
    estado === "con-nc" ? "Con nota de crédito" : estado === "sin-nc" ? "Sin nota de crédito" : "";

  return (
    <div className="p-4 space-y-4 lg:p-6 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-[#1E3A5F] text-white rounded-xl">
          <HiOutlineDocumentText size={22} />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#0F172A] tracking-tight">Facturas</h1>
          <p className="text-xs font-semibold text-slate-400">{facturas.length} facturas emitidas</p>
        </div>
      </div>

      {/* Desktop toolbar, untouched (S4): the search field, the two native date
          inputs and the "sin tope" label keep their place from `lg` up. */}
      <div className="hidden lg:block bg-white rounded-2xl border border-[#E4E7EB] shadow-sm">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1 min-w-[220px] relative">
            <HiOutlineSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por control, cliente o RIF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm font-semibold bg-[#F8FAFC] border border-[#E4E7EB] rounded-xl outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
            />
          </div>
          <div className="flex items-center gap-2">
            <HiOutlineCalendar size={15} className="text-slate-400" />
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="px-3 py-2.5 text-xs font-semibold bg-[#F8FAFC] border border-[#E4E7EB] rounded-xl outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
            />
            <span className="text-[10px] font-bold text-slate-400">→</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              title="Sin fecha: se listan todas las facturas posteriores a la fecha inicial"
              className="px-3 py-2.5 text-xs font-semibold bg-[#F8FAFC] border border-[#E4E7EB] rounded-xl outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
            />
            {!fechaHasta && (
              <span className="text-[10px] font-bold text-slate-400">sin tope</span>
            )}
          </div>
        </div>
      </div>

      {/* Phone toolbar: one search field and one button with the active-filter
          count — the dates and the state moved into the sheet (S6). */}
      <div className="flex flex-col gap-2 lg:hidden">
        <div className="relative w-full">
          <HiOutlineSearch
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            inputMode="search"
            placeholder="Buscar por control, cliente o RIF..."
            aria-label="Buscar facturas por control, cliente o RIF"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-base font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsFiltersOpen(true)}
          aria-label={`Filtros de facturas${activeFilterCount > 0 ? `, ${activeFilterCount} activos` : ""}`}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-wide text-slate-600 transition-colors active:bg-slate-100"
        >
          <HiOutlineFilter size={18} aria-hidden="true" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-black text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        <p className="px-1 text-[11px] font-bold text-slate-400">
          {`Desde ${shortDate(fechaDesde)} · ${fechaHasta ? `hasta ${shortDate(fechaHasta)}` : "sin tope"}`}
          {estadoLabel ? ` · ${estadoLabel}` : ""}
        </p>
      </div>

      <FacturasTable
        facturas={facturas}
        isLoading={isLoading}
        onRefresh={refetch}
        filtros={filtros}
        estado={effectiveEstado}
      />

      <MobileFacturasFiltersSheet
        open={isFiltersOpen}
        onOpenChange={setIsFiltersOpen}
        draft={draft}
        onApply={(next) => {
          setFechaDesde(next.desde);
          setFechaHasta(next.hasta);
          setEstado(next.estado);
        }}
        onReset={() => {
          setFechaDesde(defaultDesde);
          setFechaHasta("");
          setEstado("all");
        }}
      />
    </div>
  );
}
