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

      <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Buscar Orden</label>
          <div className="relative">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por cliente, medicamento o ID..."
              value={filters.search || ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Precio Mínimo</label>
          <input
            type="number"
            min="0"
            placeholder="Min $"
            value={filters.minPrice || ""}
            onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
            className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Precio Máximo</label>
          <input
            type="number"
            min="0"
            placeholder="Max $"
            value={filters.maxPrice || ""}
            onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
            className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha Inicio</label>
          <input
            type="date"
            value={filters.date_start || ""}
            onChange={(e) => setFilters({ ...filters, date_start: e.target.value })}
            className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha Fin</label>
          <input
            type="date"
            value={filters.date_end || ""}
            onChange={(e) => setFilters({ ...filters, date_end: e.target.value })}
            className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Ordenar por</label>
          <select
            value={filters.sortOrder || "desc"}
            onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
            className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
          >
            <option value="desc">Más recientes</option>
            <option value="asc">Más antiguas</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onReset}
          className="bg-slate-50 text-slate-400 hover:text-slate-600 font-black px-6 py-3 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
        >
          <HiOutlineX size={18} /> Limpiar Filtros
        </button>
      </div>
    </div>
  );
}
