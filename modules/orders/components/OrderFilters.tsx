"use client";
import { HiOutlineRefresh } from "react-icons/hi";

interface FiltersProps {
  filters: {
    date_start: string;
    date_end: string;
    type_sale: string;
    status: string;
  };
  onFiltersChange: (filters: any) => void;
  onReset: () => void;
}

export default function OrderFilters({ filters, onFiltersChange, onReset }: FiltersProps) {
  const filterClass =
    "px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 flex items-center gap-2 hover:border-blue-400 transition-all min-w-[140px] outline-none shadow-sm";

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <input
        type="date"
        className={filterClass}
        value={filters.date_start}
        onChange={(e) => onFiltersChange({ ...filters, date_start: e.target.value })}
        placeholder="Fecha inicio"
      />
      <input
        type="date"
        className={filterClass}
        value={filters.date_end}
        onChange={(e) => onFiltersChange({ ...filters, date_end: e.target.value })}
        placeholder="Fecha fin"
      />
      <select className={filterClass} value={filters.type_sale} onChange={(e) => onFiltersChange({ ...filters, type_sale: e.target.value })}>
        <option value="">Tipo de entrega</option>
        <option value="local">Local</option>
        <option value="delivery">Delivery</option>
      </select>
      <select className={filterClass} value={filters.status} onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}>
        <option value="">Estado del pedido</option>
        <option value="Completed">Completado</option>
        <option value="Pending">Pendiente</option>
      </select>

      <button
        onClick={onReset}
        className="flex items-center gap-2 text-red-500 text-sm font-semibold hover:bg-red-50 px-3 py-2 rounded-lg transition-colors ml-auto"
      >
        <HiOutlineRefresh className="rotate-180" /> Restablecer filtros
      </button>
    </div>
  );
}
