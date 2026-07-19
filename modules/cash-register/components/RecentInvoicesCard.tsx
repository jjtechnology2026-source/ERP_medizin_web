"use client";
import { useState } from "react";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import InvoiceDetailDialog from "@/modules/cash-register/components/InvoiceDetailDialog";
import type { CashierInvoice } from "@/modules/cash-register/types/cashier.types";

export default function RecentInvoicesCard() {
  const { sessionInvoices, activeSession } = useCashierWorkflowStore();
  const [selectedInvoice, setSelectedInvoice] = useState<CashierInvoice | null>(null);

  const profile = useAuthStore((s) => s.profile);
  const currentUser = profile?.name || "Sistema";

  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 5;

  if (!activeSession) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">
          Documentos del turno
        </h3>
        <p className="text-xs font-bold text-slate-300 text-center py-8">
          No hay sesión activa para listar facturas
        </p>
      </div>
    );
  }

  // Ordenar documentos de más reciente a más viejo
  const sortedInvoices = [...sessionInvoices].sort((a, b) => {
    const dateA = a.emittedAt ? new Date(a.emittedAt).getTime() : 0;
    const dateB = b.emittedAt ? new Date(b.emittedAt).getTime() : 0;
    return dateB - dateA;
  });

  const totalSold = sessionInvoices.reduce((sum, inv) => sum + inv.totalVes, 0);

  // Lógica de paginación
  const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentInvoices = sortedInvoices.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleString("es-VE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
      {/* Encabezado del Listado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#0055ff] rounded-full inline-block"></span>
          Documentos del turno
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total facturado:</span>
          <span className="text-xs font-black text-[#0055ff] font-mono bg-blue-50/50 border border-blue-100/50 px-3 py-1 rounded-xl">
            Bs {totalSold.toFixed(2)}
          </span>
        </div>
      </div>

      {sortedInvoices.length === 0 ? (
        <p className="text-xs font-bold text-slate-300 text-center py-10">
          Sin facturas emitidas en esta sesión activa.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 pb-2">
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 pl-1">No. Control</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3">Fecha y Hora</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3">Tipo</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3">Doc. Asociado</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3">Cliente</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3">Usuario</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 text-right">Monto Bs</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 text-right">Monto USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentInvoices.map((inv) => (
                <tr key={inv.id} onClick={() => setSelectedInvoice(inv)} className="hover:bg-slate-50/40 transition-colors cursor-pointer">
                  <td className="py-3 pl-1">
                    <span className="text-xs font-black text-slate-700 font-mono tracking-tight">
                      {inv.controlNumber}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-[11px] font-bold text-slate-500 font-mono">
                      {formatDate(inv.emittedAt)}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-xs font-bold text-slate-700">Factura</span>
                  </td>
                  <td className="py-3">
                    <span className="text-xs font-bold text-slate-500">-</span>
                  </td>
                  <td className="py-3">
                    <span className="text-xs font-bold text-slate-700 block max-w-[150px] truncate" title={inv.clientName}>
                      {inv.clientName}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-xs font-bold text-slate-700">{currentUser}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-xs font-black text-slate-800 font-mono">
                      Bs {inv.totalVes.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-[11px] font-bold text-slate-500 font-mono">
                      $ {(inv.totalVes / (inv.exchangeRate || 1)).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedInvoice && (
        <InvoiceDetailDialog invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}

      {/* Controles de Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2 flex-wrap gap-4">
          <span className="text-[10px] font-bold text-slate-400">
            Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, sortedInvoices.length)} de {sortedInvoices.length} documentos
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 text-[9px] font-black bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-6 h-6 flex items-center justify-center text-[9px] font-black rounded-lg transition-all border cursor-pointer ${
                  currentPage === i + 1
                    ? "bg-[#0055ff] text-white border-[#0055ff] shadow-xs"
                    : "bg-white text-slate-600 border-slate-200/60 hover:bg-slate-50"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 text-[9px] font-black bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}


    </div>
  );
}