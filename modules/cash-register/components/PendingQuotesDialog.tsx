"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HiX, HiOutlineRefresh } from "react-icons/hi";
import { cashierAccountantService } from "@/modules/cash-register/api/cashier-accountant.service";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import type { PendingQuote } from "@/modules/cash-register/types/cashier.types";

const r2 = (n: number) => Math.round(n * 100) / 100;

function mapConvertError(error: any): string {
  const status = error?.response?.status;
  if (status === 404) return "La cotización no existe.";
  if (status === 409) return "La cotización ya no está en estado Quoted (puede que ya esté convertida o cancelada).";
  if (status === 403) return "No está autorizado para operar sobre esta farmacia.";
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    "No se pudo convertir la cotización"
  );
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function PendingQuotesDialog({ onClose }: { onClose: () => void }) {
  const { activeSession, load, errorMessage, setError, setInfo } = useCashierWorkflowStore();
  const [quotes, setQuotes] = useState<PendingQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const refresh = async () => {
    if (!activeSession?.id) return;
    setLoading(true);
    setLocalError(null);
    try {
      const items = await cashierAccountantService.fetchPendingQuotes(activeSession.id);
      setQuotes(items);
    } catch (e: any) {
      setLocalError(
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "No se pudo cargar las cotizaciones"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSession?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await cashierAccountantService.fetchPendingQuotes(activeSession.id);
        if (!cancelled) setQuotes(items);
      } catch (e: any) {
        if (!cancelled) {
          setLocalError(
            e?.response?.data?.error ||
            e?.response?.data?.message ||
            e?.message ||
            "No se pudo cargar las cotizaciones"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSession?.id]);

  const handleConvert = async (quote: PendingQuote) => {
    if (!activeSession?.id) return;
    setConvertingId(quote.id);
    setLocalError(null);
    setError(null);
    try {
      await cashierAccountantService.convertQuote(quote.id, activeSession.id);
      setInfo(`Cotización ${quote.quoteNumber} convertida. La factura fiscal se emitirá en breve.`);
      await refresh();
      // Recarga la sesión para que la factura nueva aparezca en "Documentos del turno".
      await load();
    } catch (e: any) {
      const mensaje = mapConvertError(e);
      setLocalError(mensaje);
      setError(mensaje);
    } finally {
      setConvertingId(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-md">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col text-slate-800">
        <div className="flex items-center justify-between p-6 pb-3 flex-shrink-0">
          <h2 className="text-xl font-black text-slate-800">Cotizaciones pendientes</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              title="Actualizar"
            >
              <HiOutlineRefresh size={20} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <HiX size={20} />
            </button>
          </div>
        </div>

        {(localError || errorMessage) && (
          <div className="px-6 pb-3 flex-shrink-0">
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
              {localError || errorMessage}
            </div>
          </div>
        )}

        <div className="px-6 flex-1 overflow-y-auto pb-6">
          {!activeSession ? (
            <p className="text-xs font-bold text-slate-400 text-center py-10">
              No hay sesión activa para listar cotizaciones.
            </p>
          ) : loading && quotes.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#0055ff] border-t-transparent" />
            </div>
          ) : quotes.length === 0 ? (
            <p className="text-xs font-bold text-slate-400 text-center py-10">
              Sin cotizaciones pendientes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 pl-1">No. Cotización</th>
                    <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3">Cliente</th>
                    <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3">Fecha</th>
                    <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 text-right">Total</th>
                    <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {quotes.map((q) => {
                    const cancellable = q.saleStatus === "Cancelled";
                    const convertDisabled = cancellable || convertingId !== null;
                    return (
                      <tr key={q.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 pl-1">
                          <span className="text-xs font-black text-slate-700 font-mono tracking-tight">
                            {q.quoteNumber || "-"}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-xs font-bold text-slate-700 block max-w-[180px] truncate" title={q.clientName}>
                            {q.clientName}
                            {q.clientDocument ? (
                              <span className="text-slate-400 font-normal"> · {q.clientDocument}</span>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-[11px] font-bold text-slate-500 font-mono">
                            {formatDate(q.date)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-xs font-black text-slate-800 font-mono">
                            $ {r2(q.totalUsd).toFixed(2)}
                          </span>
                          <span className="block text-[10px] font-bold text-slate-400 font-mono">
                            Bs {r2(q.totalVes).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleConvert(q)}
                            disabled={convertDisabled}
                            className="px-3 py-1.5 bg-[#0055ff] text-white rounded-xl font-black text-[11px] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {convertingId === q.id ? "Convirtiendo..." : "Convertir a venta"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
