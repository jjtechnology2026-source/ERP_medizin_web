"use client";

import { HiOutlineRefresh, HiSearch } from "react-icons/hi";
import { AuditLogFilters } from "../types";

interface AuditFiltersProps {
  filters: AuditLogFilters;
  setFilters: (filters: AuditLogFilters) => void;
  actions: string[];
  entities: string[];
  onReset: () => void;
}

const inputClass =
  "w-full min-w-0 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default function AuditFilters({ filters, setFilters, actions, entities, onReset }: AuditFiltersProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-[1.8fr_1fr]">
      <div className="space-y-4">
        <label className="relative block">
          <HiSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.entityId ?? ""}
            onChange={(event) => setFilters({ ...filters, entityId: event.target.value })}
            placeholder="Buscar por ID de entidad"
            className="w-full rounded-3xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input
            type="text"
            value={filters.userId ?? ""}
            onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
            placeholder="Usuario / actor"
            className={inputClass}
          />
          <select
            value={filters.action ?? ""}
            onChange={(event) => setFilters({ ...filters, action: event.target.value })}
            className={inputClass}
          >
            <option key="action-default" value="">Acción</option>
            {actions.map((action, index) => (
              <option key={`action-${index}`} value={action}>{action}</option>
            ))}
          </select>
          <select
            value={filters.entityName ?? ""}
            onChange={(event) => setFilters({ ...filters, entityName: event.target.value })}
            className={inputClass}
          >
            <option key="entity-default" value="">Entidad</option>
            {entities.map((entity, index) => (
              <option key={`entity-${index}`} value={entity}>{entity}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-full items-center justify-center gap-2 rounded-3xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700"
          >
            <HiOutlineRefresh className="h-4 w-4" /> Restablecer
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Desde</span>
          <input
            type="date"
            value={filters.startDate ?? ""}
            onChange={(event) => setFilters({ ...filters, startDate: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hasta</span>
          <input
            type="date"
            value={filters.endDate ?? ""}
            onChange={(event) => setFilters({ ...filters, endDate: event.target.value })}
            className={inputClass}
          />
        </label>
      </div>
    </div>
  );
}
