"use client";
import { useState } from "react";
import {
  HiOutlineEye,
  HiOutlineDocumentText,
  HiOutlineRefresh,
} from "react-icons/hi";
import type { FacturaListItem } from "../types";
import FacturaNotaCreditoDialog from "./FacturaNotaCreditoDialog";

interface FacturasTableProps {
  facturas: FacturaListItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

export default function FacturasTable({ facturas, isLoading, onRefresh }: FacturasTableProps) {
  const [selectedFactura, setSelectedFactura] = useState<FacturaListItem | null>(null);
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
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="text-lg font-black text-slate-800">
          Facturas <span className="text-sm font-bold text-slate-400 ml-2">({facturas.length})</span>
        </h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          <HiOutlineRefresh size={14} className={isLoading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-slate-700" />
        </div>
      ) : facturas.length === 0 ? (
        <div className="py-20 text-center">
          <HiOutlineDocumentText size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">No se encontraron facturas</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-3">Nro. Control</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-3">Fecha</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-3">Cliente</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-3">RIF</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-3 text-right">Total VES</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-3 text-right">Total USD</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageItems.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-3">
                      <span className="text-xs font-black text-slate-700 font-mono tracking-tight">
                        {f.numero_control}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-[11px] font-bold text-slate-500 font-mono">
                        {formatDate(f.fecha_emision)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs font-bold text-slate-700 block max-w-[180px] truncate" title={f.cliente_nombre}>
                        {f.cliente_nombre}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs font-bold text-slate-500 font-mono">{f.cliente_rif || "—"}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-xs font-black text-slate-800 font-mono">
                        Bs {f.total_ves.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-[11px] font-bold text-slate-500 font-mono">
                        $ {f.total_usd.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {f.url_pdf && (
                          <a
                            href={f.url_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                            title="Ver PDF"
                          >
                            <HiOutlineEye size={15} />
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedFactura(f)}
                          className="p-2 rounded-lg border border-amber-100 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all"
                          title="Emitir Nota de Crédito"
                        >
                          <HiOutlineDocumentText size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400">
                Mostrando {start + 1}–{Math.min(start + perPage, facturas.length)} de {facturas.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 text-[9px] font-black bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 rounded-lg transition-all disabled:opacity-40"
                >
                  Anterior
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`w-6 h-6 flex items-center justify-center text-[9px] font-black rounded-lg transition-all border ${
                      page === i + 1
                        ? "bg-[#0055ff] text-white border-[#0055ff]"
                        : "bg-white text-slate-600 border-slate-200/60 hover:bg-slate-50"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 text-[9px] font-black bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 rounded-lg transition-all disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
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
