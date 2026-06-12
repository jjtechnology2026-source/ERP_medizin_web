"use client";

import { useState } from "react";
import { HiOutlineChevronDown, HiOutlineChevronUp } from "react-icons/hi";
import { AuditLogEntry } from "../types";

const formatTimestamp = (timestamp: string) => {
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
};

export default function AuditEntryCard({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap gap-3">
              <span className="rounded-3xl bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-slate-600">{entry.action}</span>
              <span className="rounded-3xl bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">{entry.entityName}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">ID de entidad</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 wrap-break-word">{entry.entityId || "-"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Usuario</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{entry.actorName || entry.userId || "-"}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Fecha</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatTimestamp(entry.timestamp)}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              {open ? <HiOutlineChevronUp className="h-5 w-5" /> : <HiOutlineChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">IP</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{entry.ipAddress ?? "No disponible"}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Agente</p>
            <p className="mt-2 text-sm font-semibold text-slate-800 wrap-break-word">{entry.userAgent ?? "No registrado"}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Estado</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{entry.oldValues || entry.newValues ? "Con detalles" : "Sin cambios"}</p>
          </div>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Valores anteriores</p>
              <pre className="mt-3 max-h-48 overflow-auto text-xs text-slate-700">{entry.oldValues ? JSON.stringify(entry.oldValues, null, 2) : "Ninguno"}</pre>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Valores nuevos</p>
              <pre className="mt-3 max-h-48 overflow-auto text-xs text-slate-700">{entry.newValues ? JSON.stringify(entry.newValues, null, 2) : "Ninguno"}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
