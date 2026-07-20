"use client";
import { useEffect, useState } from "react";
import { HiX, HiDocumentText, HiUser, HiHashtag, HiCalendar, HiIdentification } from "react-icons/hi";
import { cashierAccountantService } from "@/modules/cash-register/api/cashier-accountant.service";
import type { CashierInvoice, CashierInvoiceDetail } from "@/modules/cash-register/types/cashier.types";

interface InvoiceDetailDialogProps {
  invoice: CashierInvoice;
  onClose: () => void;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-lg ${className}`} />;
}

export default function InvoiceDetailDialog({ invoice, onClose }: InvoiceDetailDialogProps) {
  const [detail, setDetail] = useState<CashierInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    cashierAccountantService.fetchInvoiceDetail(invoice.id)
      .then((data) => { if (mounted) { setDetail(data); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [invoice.id]);

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

  const d = detail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* ===== HEADER ===== */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <HiDocumentText className="text-blue-600" size={18} />
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                Factura <span className="text-slate-500">#{invoice.controlNumber}</span>
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200 active:scale-95"
            >
              <HiX size={20} className="text-slate-400" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 py-4">
              <div className="flex items-center justify-center gap-2">
                <SkeletonBlock className="h-4 w-4 rounded-full" />
                <span className="text-sm font-bold text-slate-300">Cargando detalle...</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SkeletonBlock className="h-10" />
                <SkeletonBlock className="h-10" />
                <SkeletonBlock className="h-10" />
                <SkeletonBlock className="h-10" />
              </div>
            </div>
          ) : d ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
              <div className="col-span-2 lg:col-span-4 flex items-start gap-3 pb-2 border-b border-slate-50 mb-1">
                <HiUser className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cliente</span>
                  <p className="font-semibold text-slate-800">{d.clientName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <HiCalendar className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fecha</span>
                  <p className="font-semibold text-slate-700">{formatDate(d.emittedAt)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <HiIdentification className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">RIF</span>
                  <p className="font-semibold text-slate-700">{d.clientRif}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <HiHashtag className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Base Imponible</span>
                  <p className="font-semibold text-slate-700 font-mono">Bs {d.baseImponibleVes.toFixed(2)}</p>
                </div>
              </div>
              {d.totalExentoVes > 0 && (
                <div className="flex items-start gap-3">
                  <HiHashtag className="text-slate-300 mt-0.5 shrink-0" size={14} />
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Exento</span>
                    <p className="font-semibold text-slate-500 font-mono">Bs {d.totalExentoVes.toFixed(2)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <HiHashtag className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">IVA ({d.ivaPorcentaje}%)</span>
                  <p className="font-semibold text-slate-700 font-mono">Bs {d.ivaMontoVes.toFixed(2)}</p>
                </div>
              </div>
              {d.igtfMontoVes != null && d.igtfMontoVes > 0 && (
                <div className="flex items-start gap-3">
                  <HiHashtag className="text-slate-300 mt-0.5 shrink-0" size={14} />
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">IGTF</span>
                    <p className="font-semibold text-amber-700 font-mono">Bs {d.igtfMontoVes.toFixed(2)}</p>
                  </div>
                </div>
              )}
              {d.retencionAplicada != null && d.retencionAplicada > 0 && (
                <div className="flex items-start gap-3">
                  <HiHashtag className="text-slate-300 mt-0.5 shrink-0" size={14} />
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Retención</span>
                    <p className="font-semibold text-red-600 font-mono">- Bs {d.retencionAplicada.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-4">
              <span className="text-xs font-bold text-red-400 bg-red-50 px-3 py-1.5 rounded-lg">Error al cargar detalle</span>
            </div>
          )}
        </div>

        {/* ===== LINE ITEMS ===== */}
        <div className="flex-1 overflow-y-auto">
          {loading ? null : !d || d.lines.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm font-bold text-slate-300">Sin líneas disponibles</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100">
                  <th className="px-6 pb-2 pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-12">Cant.</th>
                  <th className="pb-2 pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Descripción</th>
                  <th className="pb-2 pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right w-28">Precio Unit.</th>
                  <th className="pb-2 pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right w-12">Desc.</th>
                  <th className="pb-2 pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right w-16">IVA</th>
                  <th className="pb-2 pt-4 pr-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {d.lines.map((line, idx) => {
                  const lineTotal = line.subtotalVes ?? line.quantity * line.unitPriceVes;
                  return (
                    <tr
                      key={line.id}
                      className="hover:bg-blue-50/40 transition-colors duration-150"
                    >
                      <td className="px-6 py-3 align-top">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-50 text-[11px] font-bold text-slate-600">
                          {line.quantity}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-xs font-semibold text-slate-800 leading-relaxed">{line.description}</p>
                        {line.productoId && (
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {line.productoId}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right align-top">
                        {line.discount ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-slate-400 line-through">Bs {(line.unitPriceVes / (1 - line.discount / 100)).toFixed(2)}</span>
                            <span className="text-xs font-semibold text-emerald-600 font-mono">Bs {line.unitPriceVes.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-500 font-mono">Bs {line.unitPriceVes.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right align-top">
                        <span className="text-[10px] font-semibold text-amber-600">{line.discount ? `${line.discount}%` : "-"}</span>
                      </td>
                      <td className="py-3 pr-4 text-right align-top">
                        <span className="text-[11px] font-semibold text-slate-400">{line.vatPercentage}%</span>
                      </td>
                      <td className="py-3 pr-6 text-right align-top">
                        <span className="text-xs font-bold text-slate-800 font-mono">Bs {lineTotal.toFixed(2)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== FOOTER / TOTALS ===== */}
        {d && (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/40">
            {/* Totales principales */}
            <div className="px-6 pt-4 pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bs</span>
                <span className="text-xl font-bold text-amber-600 font-mono tracking-tight">Bs {d.totalVes.toFixed(2)}</span>
              </div>
              {d.totalUsd > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total USD</span>
                  <span className="text-lg font-bold text-slate-800 font-mono">$ {d.totalUsd.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-400 uppercase tracking-wider">Tasa de cambio</span>
                <span className="font-semibold text-slate-500 font-mono">
                  {d.exchangeRate ? `Bs ${d.exchangeRate.toFixed(2)} / $` : "-"}
                </span>
              </div>
            </div>

            {/* Payment info */}
            {d.transaccion && (
              <div className="border-t border-slate-100 px-6 py-3">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Información de pago</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-2 gap-x-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-400">Método:</span>
                    <span className="font-semibold text-slate-700 capitalize">{d.transaccion.metodoPago}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-400">Moneda:</span>
                    <span className="font-semibold text-slate-700">{d.transaccion.moneda}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-400">Monto:</span>
                    <span className="font-semibold text-slate-700 font-mono">
                      {d.transaccion.moneda === "USD" ? "$" : "Bs"} {d.transaccion.montoOriginal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-400">Monto VES:</span>
                    <span className="font-semibold text-slate-700 font-mono">Bs {d.transaccion.montoVes.toFixed(2)}</span>
                  </div>
                  {d.transaccion.descripcion && (
                    <div className="col-span-full flex items-center gap-2">
                      <span className="font-medium text-slate-400 shrink-0">Referencia:</span>
                      <span className="font-semibold text-slate-600">{d.transaccion.descripcion}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Observaciones */}
            {d.observaciones && (
              <div className="border-t border-slate-100 px-6 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Observaciones</span>
                </div>
                <p className="text-xs font-medium text-slate-600 bg-white rounded-xl px-4 py-2.5 border border-slate-100 leading-relaxed">
                  {d.observaciones}
                </p>
              </div>
            )}

            {/* Tax breakdown */}
            <div className="border-t border-slate-100 px-6 py-3 flex flex-wrap gap-4 text-[11px]">
              {d.ivaRetenidoClienteVes != null && d.ivaRetenidoClienteVes > 0 && (
                <span className="text-slate-400">
                  IVA retenido cliente: <span className="font-semibold text-slate-600 font-mono">Bs {d.ivaRetenidoClienteVes.toFixed(2)}</span>
                </span>
              )}
              {d.ivaAPagarEmpresaVes != null && d.ivaAPagarEmpresaVes > 0 && (
                <span className="text-slate-400">
                  IVA a pagar empresa: <span className="font-semibold text-slate-600 font-mono">Bs {d.ivaAPagarEmpresaVes.toFixed(2)}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
