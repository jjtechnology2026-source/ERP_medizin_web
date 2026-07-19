"use client";
import { HiX } from "react-icons/hi";
import type { CashierInvoice } from "@/modules/cash-register/types/cashier.types";

interface InvoiceDetailDialogProps {
  invoice: CashierInvoice;
  onClose: () => void;
}

export default function InvoiceDetailDialog({ invoice, onClose }: InvoiceDetailDialogProps) {
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

  const subtotal = invoice.lines.reduce((s, l) => s + l.quantity * l.unitPriceVes, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
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
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha</span>
              <p className="font-bold text-slate-700">{formatDate(invoice.emittedAt)}</p>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">RIF</span>
              <p className="font-bold text-slate-700">{invoice.clientRif || "-"}</p>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cliente</span>
              <p className="font-bold text-slate-700">{invoice.clientName || "-"}</p>
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto p-6">
          {invoice.lines.length === 0 ? (
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
                {invoice.lines.map((line) => {
                  const lineTotal = line.quantity * line.unitPriceVes;
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

        {/* Footer with total */}
        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-slate-500 uppercase tracking-wider">Total</span>
            <span className="text-lg font-black text-slate-800 font-mono">
              Bs {invoice.totalVes.toFixed(2)}
            </span>
          </div>
          {invoice.exchangeRate && invoice.exchangeRate > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tasa de cambio</span>
              <span className="text-xs font-bold text-slate-500 font-mono">
                Bs {invoice.exchangeRate.toFixed(2)} / $
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
