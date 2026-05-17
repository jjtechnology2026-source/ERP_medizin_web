"use client";
import { useState } from "react";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { HiOutlineDocumentText, HiOutlineExternalLink, HiOutlinePrinter } from "react-icons/hi";

export default function RecentInvoicesCard() {
  const { 
    sessionInvoices, 
    activeSession, 
    issueCreditNote, 
    issueDebitNote,
    isSubmitting 
  } = useCashierWorkflowStore();

  // Estados locales para paginación y modal de NC/ND
  const [currentPage, setCurrentPage] = useState(1);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "NC" | "ND" | null;
    invoiceId: string | null;
  }>({
    isOpen: false,
    type: null,
    invoiceId: null,
  });
  const [reason, setReason] = useState("");

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

  const openModal = (type: "NC" | "ND", invoiceId: string) => {
    setModalState({
      isOpen: true,
      type,
      invoiceId,
    });
    setReason("");
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      type: null,
      invoiceId: null,
    });
    setReason("");
  };

  const handleSubmitNote = async () => {
    const { type, invoiceId } = modalState;
    if (!type || !invoiceId || !reason.trim()) return;

    try {
      if (type === "NC") {
        await issueCreditNote(invoiceId, reason.trim());
      } else {
        await issueDebitNote(invoiceId, reason.trim());
      }
      closeModal();
    } catch (error) {
      console.error("Error al procesar la nota:", error);
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
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 pb-2">
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 pl-1">No. Control</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3">Fecha Emisión</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3">Cliente</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 text-right">Monto Bs</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 text-right">Monto USD</th>
                <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/40 transition-colors">
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
                    <span className="text-xs font-bold text-slate-700 block max-w-[200px] truncate" title={inv.clientName}>
                      {inv.clientName}
                    </span>
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
                  <td className="py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100/80 border border-blue-200/50 text-blue-600 rounded-lg text-[9px] font-black transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <HiOutlineExternalLink size={11} />
                          PDF
                        </a>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-300 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg select-none">
                          Sin PDF
                        </span>
                      )}
                      <button
                        onClick={() => openModal("NC", inv.id)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/50 text-amber-600 rounded-lg text-[9px] font-black transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        NC
                      </button>
                      <button
                        onClick={() => openModal("ND", inv.id)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/50 text-rose-600 rounded-lg text-[9px] font-black transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        ND
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {/* Modal Hermoso de Motivo para NC y ND */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
              <span className={`w-1.5 h-4 rounded-full inline-block ${
                modalState.type === "NC" ? "bg-amber-500" : "bg-rose-500"
              }`}></span>
              Emitir Nota de {modalState.type === "NC" ? "Crédito" : "Débito"}
            </h4>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Por favor, ingrese el motivo para esta nota asociada al documento.
            </p>

            <div className="mt-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Motivo / Razón de la emisión:
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ingrese una descripción detallada..."
                className="w-full mt-1.5 p-3 text-xs font-bold bg-slate-50 border border-slate-100 focus:bg-white focus:border-slate-200 focus:ring-2 focus:ring-blue-500/20 rounded-xl outline-none min-h-[100px] resize-none transition-all placeholder:text-slate-300 font-bold"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-black bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/50 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitNote}
                disabled={!reason.trim() || isSubmitting}
                className={`px-5 py-2 text-xs font-black text-white rounded-xl transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50 disabled:hover:scale-100 ${
                  modalState.type === "NC"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-rose-500 hover:bg-rose-600"
                }`}
              >
                {isSubmitting ? "Procesando..." : "Confirmar Emisión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
