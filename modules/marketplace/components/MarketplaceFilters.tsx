"use client";
import { HiOutlineSearch, HiOutlineFilter, HiOutlineCalendar, HiOutlineX } from "react-icons/hi";

interface MarketplaceFiltersProps {
  filters: any;
  setFilters: (filters: any) => void;
  onReset: () => void;
}

export default function MarketplaceFilters({ filters, setFilters, onReset }: MarketplaceFiltersProps) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <HiOutlineFilter className="text-blue-600" size={20} />
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Filtros de búsqueda</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          >
            <option value="">Todos los estados</option>
            <option value="Pending">Pendiente</option>
            <option value="Completed">Completado</option>
            <option value="Cancelled">Cancelado</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha Inicio</label>
          <input
            type="date"
            value={filters.date_start}
            onChange={(e) => setFilters({ ...filters, date_start: e.target.value })}
            className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha Fin</label>
          <input
            type="date"
            value={filters.date_end}
            onChange={(e) => setFilters({ ...filters, date_end: e.target.value })}
            className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div className="flex items-end gap-3">
          <button
            onClick={onReset}
            className="flex-1 bg-slate-50 text-slate-400 font-black py-3.5 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <HiOutlineX size={18} /> Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}
