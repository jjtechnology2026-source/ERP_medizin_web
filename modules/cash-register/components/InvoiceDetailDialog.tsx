"use client";
import { useEffect, useState } from "react";
import { HiX } from "react-icons/hi";
import { cashierAccountantService } from "@/modules/cash-register/api/cashier-accountant.service";
import type { CashierInvoice, CashierInvoiceDetail } from "@/modules/cash-register/types/cashier.types";

interface InvoiceDetailDialogProps {
  invoice: CashierInvoice;
  onClose: () => void;
}

export default function InvoiceDetailDialog({ invoice, onClose }: InvoiceDetailDialogProps) {
  const [detail, setDetail] = useState<CashierInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    cashierAccountantService.fetchInvoiceDetail(invoice.id).then((data) => {
      if (mounted) {
        setDetail(data);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });
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
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-800">
              Factura #{invoice.controlNumber}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <HiX size={20} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : d ? (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha</span>
                  <p className="font-bold text-slate-700">{formatDate(d.emittedAt)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">RIF</span>
                  <p className="font-bold text-slate-700">{d.clientRif}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cliente</span>
                  <p className="font-bold text-slate-700">{d.clientName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Base Imponible</span>
                  <p className="font-bold text-slate-700 font-mono">Bs {d.baseImponibleVes.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">IVA ({d.ivaPorcentaje}%)</span>
                  <p className="font-bold text-slate-700 font-mono">Bs {d.ivaMontoVes.toFixed(2)}</p>
                </div>
                {d.igtfMontoVes != null && d.igtfMontoVes > 0 && (
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">IGTF</span>
                    <p className="font-bold text-slate-700 font-mono">Bs {d.igtfMontoVes.toFixed(2)}</p>
                  </div>
                )}
                {d.retencionAplicada != null && d.retencionAplicada > 0 && (
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Retención</span>
                    <p className="font-bold text-red-600 font-mono">- Bs {d.retencionAplicada.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm font-bold text-slate-300 text-center py-4">Error al cargar detalle</p>
          )}
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? null : !d || d.lines.length === 0 ? (
            <p className="text-sm font-bold text-slate-300 text-center py-8">Sin líneas disponibles</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cant.</th>
                  <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción</th>
                  <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Precio Unit.</th>
                  <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">IVA</th>
                  <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {d.lines.map((line) => {
                  const lineTotal = line.subtotalVes ?? line.quantity * line.unitPriceVes;
                  return (
                    <tr key={line.id}>
                      <td className="py-3 pr-2">
                        <span className="text-xs font-black text-slate-700">{line.quantity}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs font-bold text-slate-700">{line.description}</span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-xs font-bold text-slate-600 font-mono">
                          Bs {line.unitPriceVes.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          {line.vatPercentage}%
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-xs font-black text-slate-800 font-mono">
                          Bs {lineTotal.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 space-y-2">
          {d && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-500 uppercase tracking-wider">Total Bs</span>
                <span className="text-lg font-black text-slate-800 font-mono">Bs {d.totalVes.toFixed(2)}</span>
              </div>
              {d.totalUsd > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-500 uppercase tracking-wider">Total USD</span>
                  <span className="text-lg font-black text-slate-800 font-mono">$ {d.totalUsd.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-slate-400 uppercase tracking-wider">Tasa de cambio</span>
                <span className="font-bold text-slate-500 font-mono">
                  {d.exchangeRate ? `Bs ${d.exchangeRate.toFixed(2)} / $` : "-"}
                </span>
              </div>

              {d.transaccion && (
                <div className="border-t border-slate-50 pt-3 mt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Información de pago</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-500">Método:</span>
                      <span className="font-bold text-slate-700 ml-1 capitalize">{d.transaccion.metodoPago}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500">Moneda:</span>
                      <span className="font-bold text-slate-700 ml-1">{d.transaccion.moneda}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500">Monto original:</span>
                      <span className="font-bold text-slate-700 font-mono ml-1">
                        {d.transaccion.moneda === "USD" ? "$" : "Bs"} {d.transaccion.montoOriginal.toFixed(2)}
                      </span>
                    </div>
                    {d.transaccion.descripcion && (
                      <div className="col-span-2">
                        <span className="font-bold text-slate-500">Descripción:</span>
                        <span className="font-bold text-slate-700 ml-1">{d.transaccion.descripcion}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {d.observaciones && (
                <div className="border-t border-slate-50 pt-3 mt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Observaciones</span>
                  <p className="text-xs font-bold text-slate-600 mt-1">{d.observaciones}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
