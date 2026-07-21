"use client";
import { useState } from "react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useFacturas } from "./hooks/useFacturas";
import FacturasTable from "./components/FacturasTable";
import type { FacturaFilters } from "./types";

function todayStr() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

export default function FacturasFeature() {
  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId || "";

  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState(todayStr());
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-800">Facturas</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <input
          type="text"
          placeholder="Buscar por número de control, cliente o RIF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[250px] p-3 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="p-3 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="p-3 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <FacturasTable facturas={facturas} isLoading={isLoading} onRefresh={refetch} />
    </div>
  );
}
