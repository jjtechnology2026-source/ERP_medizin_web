"use client";

import { useEffect, useMemo, useState } from "react";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import AuditFilters from "./components/AuditFilters";
import AuditEntryCard from "./components/AuditEntryCard";
import { AuditLogEntry, AuditLogFilters } from "./types";
import { AuditService } from "./services/audit";

const formatNumber = (value: number) => new Intl.NumberFormat("es-VE").format(value);

export function AuditLogsSection() {
  const { profile } = useAuthStore();
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const params = useMemo(
    () => AuditService.buildParams(filters, currentPage, itemsPerPage),
    [filters, currentPage],
  );

  const { data, isLoading } = useApiQuery<{
    items: AuditLogEntry[];
    total: number;
    limit: number;
    offset: number;
  }>(["audit-logs", params], "/admin/audit/logs", {
    enabled: !!profile?.id_group,
    params: {
      ...params,
      id_group: profile?.id_group,
    },
  });

  const logs = useMemo(
    () => data?.items?.map(AuditService.normalizeAuditEntry) ?? [],
    [data],
  );
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeFiltersCount = useMemo(
    () => Object.values(filters).filter((value) => !!value).length,
    [filters],
  );

  const entityOptions = useMemo(
    () => Array.from(new Set(logs.map((item) => item.entityName))).sort(),
    [logs],
  );
  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((item) => item.action))).sort(),
    [logs],
  );

  const resetFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const handleChange = (next: AuditLogFilters) => {
    setFilters(next);
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="gap-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:flex md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500 font-bold">Auditoría</p>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Logs de auditoría</h1>
          <p className="max-w-2xl text-sm text-slate-500 font-medium">Consulta eventos de auditoría, filtros detallados y registros extendidos para cada cambio.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 p-5 text-center border border-slate-100">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">Registros</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{formatNumber(total)}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 text-center border border-slate-100">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">Filtros activos</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{activeFiltersCount}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 text-center border border-slate-100">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">Página</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{currentPage} / {totalPages}</p>
          </div>
        </div>
      </div>

      <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6">
          <AuditFilters
            filters={filters}
            setFilters={handleChange}
            actions={actionOptions}
            entities={entityOptions}
            onReset={resetFilters}
          />

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-4">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 font-bold italic">Cargando registros...</div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold italic">No hay registros de auditoría para estos filtros.</div>
            ) : (
              <div className="grid gap-4">
                {logs.map((entry) => (
                  <AuditEntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-2">
            <p className="text-sm text-slate-400 font-bold">
              Mostrando <span className="text-slate-900">{logs.length}</span> de <span className="text-slate-900">{total}</span> registros
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm active:scale-95"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm active:scale-95"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 bg-[#F8FAFC] p-4 md:p-8">
      <AuditLogsSection />
    </div>
  );
}
