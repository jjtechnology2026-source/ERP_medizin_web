"use client";
import { useState, useCallback } from "react";
import { HiOutlineDocumentText, HiOutlineSearch, HiOutlineCalendar } from "react-icons/hi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useFacturas } from "./hooks/useFacturas";
import FacturasTable from "./components/FacturasTable";
import type { FacturaFilters } from "./types";

function todayStr() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}
function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split("T")[0];
}

export default function FacturasFeature() {
  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId || "";

  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState(monthAgoStr());
  const [fechaHasta, setFechaHasta] = useState(todayStr());

  const filtros: FacturaFilters = {
    pharmacy_id: pharmacyId,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(fechaDesde ? { fecha_desde: fechaDesde } : {}),
    ...(fechaHasta ? { fecha_hasta: fechaHasta } : {}),
  };

  const { facturas, isLoading, refetch } = useFacturas(filtros);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-[#1E3A5F] text-white rounded-xl">
          <HiOutlineDocumentText size={22} />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#0F172A] tracking-tight">Facturas</h1>
          <p className="text-xs font-semibold text-slate-400">{facturas.length} facturas emitidas</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E7EB] shadow-sm">
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
              className="px-3 py-2.5 text-xs font-semibold bg-[#F8FAFC] border border-[#E4E7EB] rounded-xl outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
            />
          </div>
        </div>
      </div>

      <FacturasTable facturas={facturas} isLoading={isLoading} onRefresh={refetch} />
    </div>
  );
}
