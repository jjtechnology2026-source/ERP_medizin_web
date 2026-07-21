"use client";
import { useState } from "react";
import {
  HiOutlineEye,
  HiOutlineDocumentText,
  HiOutlineRefresh,
  HiOutlineSearch,
} from "react-icons/hi";
import type { FacturaListItem } from "../types";
import FacturaNotaCreditoDialog from "./FacturaNotaCreditoDialog";
import FacturaDetailDialog from "./FacturaDetailDialog";

interface FacturasTableProps {
  facturas: FacturaListItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-6 py-3">
          <div className={`h-4 bg-[#F1F3F5] rounded-lg ${i === 0 ? "w-24" : i === 2 ? "w-32" : i === 3 ? "w-20" : i === 4 ? "w-16 ml-auto" : i === 5 ? "w-14 ml-auto" : i === 6 ? "w-16 mx-auto" : "w-28"}`} />
        </td>
      ))}
    </tr>
  );
}

export default function FacturasTable({ facturas, isLoading, onRefresh }: FacturasTableProps) {
  const [selectedFactura, setSelectedFactura] = useState<FacturaListItem | null>(null);
  const [selectedDetailFactura, setSelectedDetailFactura] = useState<FacturaListItem | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const totalPages = Math.ceil(facturas.length / perPage);
  const start = (page - 1) * perPage;
  const pageItems = facturas.slice(start, start + perPage);

  const formatDate = (d: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("es-VE", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false,
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E4E7EB] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E7EB]">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-[#0F172A]">Facturas</span>
          {!isLoading && (
            <span className="text-[11px] font-bold text-slate-400 bg-[#F8FAFC] px-2 py-0.5 rounded-md border border-[#E4E7EB]">
              {facturas.length}
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8FAFC] hover:bg-[#F1F3F5] text-slate-600 rounded-lg text-[11px] font-bold transition-all duration-200 border border-[#E4E7EB] disabled:opacity-50"
        >
          <HiOutlineRefresh size={13} className={isLoading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-[#F1F3F5]">
              <th className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">Nro. Control</th>
              <th className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">Fecha</th>
              <th className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">Cliente</th>
              <th className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">RIF</th>
              <th className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3 text-right">Total VES</th>
              <th className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3 text-right">Total USD</th>
              <th className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3 text-center w-28">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F8FAFC]">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : facturas.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#F8FAFC] border border-[#E4E7EB] flex items-center justify-center mb-4">
                      <HiOutlineSearch size={24} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-[#0F172A] mb-1">No hay facturas en este período</p>
                    <p className="text-xs text-slate-400 text-center max-w-xs">
                      Probá ajustando las fechas de búsqueda o verificá que la farmacia tenga facturas emitidas.
                    </p>
                  </div>
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-sm font-bold text-slate-400">No hay facturas en esta página</p>
                  </div>
                </td>
              </tr>
            ) : (
              pageItems.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setSelectedDetailFactura(f)}
                  className="group cursor-pointer transition-all duration-200 hover:bg-[#F8FAFC] hover:shadow-[inset_0_1px_0_0_rgba(37,99,235,0.06)]"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0F172A] font-mono tracking-tight">
                        {f.numero_control}
                      </span>
                      {f.url_pdf && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#059669] shrink-0" title="PDF disponible" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-semibold text-slate-500 font-mono">
                      {formatDate(f.fecha_emision)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold text-slate-700 block max-w-[180px] truncate" title={f.cliente_nombre}>
                      {f.cliente_nombre}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold text-slate-400 font-mono">{f.cliente_rif || "—"}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-bold text-[#1E3A5F] font-mono">
                      Bs {f.total_ves.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-[11px] font-semibold text-slate-500 font-mono">
                      $ {f.total_usd.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200" onClick={(e) => e.stopPropagation()}>
                      {f.url_pdf && (
                        <a
                          href={f.url_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-[#2563EB]/5 transition-all duration-200"
                          title="Ver PDF"
                        >
                          <HiOutlineEye size={15} />
                        </a>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedFactura(f); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#059669] hover:bg-[#059669]/5 transition-all duration-200"
                        title="Emitir Nota de Crédito"
                      >
                        <HiOutlineDocumentText size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && facturas.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E4E7EB] bg-[#F8FAFC]/50">
          <span className="text-[10px] font-semibold text-slate-400">
            {start + 1}–{Math.min(start + perPage, facturas.length)} de {facturas.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:text-[#1E3A5F] hover:bg-white rounded-lg transition-all duration-200 border border-transparent hover:border-[#E4E7EB] disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent disabled:hover:border-transparent"
            >
              Anterior
            </button>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(totalPages, 8) }).map((_, i) => {
                const pageNum = totalPages <= 8 ? i + 1 : (() => {
                  if (page <= 4) return i + 1;
                  if (page >= totalPages - 3) return totalPages - 7 + i;
                  return page - 4 + i;
                })();
                const isActive = page === pageNum;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`min-w-[28px] h-7 flex items-center justify-center text-[10px] font-bold rounded-lg transition-all duration-200 border ${
                      isActive
                        ? "bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-sm"
                        : "text-slate-500 border-transparent hover:bg-white hover:border-[#E4E7EB]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:text-[#1E3A5F] hover:bg-white rounded-lg transition-all duration-200 border border-transparent hover:border-[#E4E7EB] disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent disabled:hover:border-transparent"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {selectedDetailFactura && (
        <FacturaDetailDialog
          factura={selectedDetailFactura}
          onClose={() => setSelectedDetailFactura(null)}
        />
      )}
      {selectedFactura && (
        <FacturaNotaCreditoDialog
          factura={selectedFactura}
          onClose={() => setSelectedFactura(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
