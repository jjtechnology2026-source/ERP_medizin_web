"use client";
import { useEffect, useState } from "react";
import { HiX, HiDocumentText, HiUser, HiHashtag, HiCalendar, HiIdentification, HiCash } from "react-icons/hi";
import { facturasService } from "../api/facturas.service";
import type { FacturaListItem, FacturaDetail } from "../types";

interface FacturaDetailDialogProps {
  factura: FacturaListItem;
  onClose: () => void;
}

export default function FacturaDetailDialog({ factura, onClose }: FacturaDetailDialogProps) {
  const [detail, setDetail] = useState<FacturaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    facturasService.detail(factura.id)
      .then((data) => { if (mounted) { setDetail(data); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [factura.id]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleString("es-VE", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false,
      });
    } catch {
      return dateString;
    }
  };

  const metodoPagoColor: Record<string, string> = {
    EFECTIVO: "bg-[#059669]/10 text-[#059669] border-[#059669]/20",
    TRANSFERENCIA: "bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20",
    PUNTO_DE_VENTA: "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/20",
    ZELLE: "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20",
    PAGOMOVIL: "bg-[#0891B2]/10 text-[#0891B2] border-[#0891B2]/20",
  };

  const d = detail;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[32px] shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in duration-200">
        {/* ===== HEADER ===== */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[#E4E7EB]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1E3A5F] flex items-center justify-center shadow-sm">
                <HiDocumentText className="text-white" size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
                  Factura <span className="text-slate-400 font-mono font-semibold">#{factura.numero_control}</span>
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F1F3F5] rounded-xl transition-all duration-200 active:scale-95"
            >
              <HiX size={20} className="text-slate-400" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 w-16 bg-[#F1F3F5] rounded mb-2" />
                    <div className="h-4 w-32 bg-[#F1F3F5] rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : d ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
              <div className="col-span-2 lg:col-span-4 flex items-start gap-3 pb-2.5 border-b border-[#F1F3F5] mb-1">
                <HiUser className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cliente</span>
                  <p className="font-semibold text-[#0F172A]">{d.cliente_nombre}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <HiCalendar className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fecha</span>
                  <p className="font-semibold text-slate-700 font-mono text-xs">{formatDate(d.fecha_emision)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <HiIdentification className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">RIF</span>
                  <p className="font-semibold text-slate-700 font-mono text-xs">{d.cliente_rif || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <HiHashtag className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Base Imponible</span>
                  <p className="font-semibold text-[#1E3A5F] font-mono text-xs">Bs {d.base_imponible_ves.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <HiHashtag className="text-slate-300 mt-0.5 shrink-0" size={14} />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">IVA</span>
                  <p className="font-semibold text-[#1E3A5F] font-mono text-xs">
                    Bs {d.iva_monto_ves.toFixed(2)} <span className="text-slate-400 font-normal">({d.iva_porcentaje}%)</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-4">
              <span className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">Error al cargar detalle</span>
            </div>
          )}
        </div>

        {/* ===== LINE ITEMS ===== */}
        <div className="flex-1 overflow-y-auto">
          {loading ? null : !d || d.detalles.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm font-bold text-slate-300">Sin líneas disponibles</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-[#F1F3F5]">
                  <th className="px-6 pb-2 pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-12">Cant.</th>
                  <th className="pb-2 pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Descripción</th>
                  <th className="pb-2 pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right w-28">Precio Unit.</th>
                  <th className="pb-2 pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right w-16">IVA</th>
                  <th className="pb-2 pt-4 pr-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {d.detalles.map((line, idx) => (
                  <tr key={line.id || idx} className="transition-colors duration-150 hover:bg-[#F8FAFC]">
                    <td className="px-6 py-3 align-top">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#F1F3F5] text-[11px] font-bold text-slate-600">
                        {line.cantidad}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-xs font-semibold text-[#0F172A] leading-relaxed">{line.descripcion}</p>
                    </td>
                    <td className="py-3 pr-4 text-right align-top">
                      <span className="text-xs font-medium text-slate-500 font-mono">Bs {line.precio_unitario_ves.toFixed(2)}</span>
                    </td>
                    <td className="py-3 pr-4 text-right align-top">
                      <span className="text-[11px] font-semibold text-slate-400">{line.iva_porcentaje}%</span>
                    </td>
                    <td className="py-3 pr-6 text-right align-top">
                      <span className="text-xs font-bold text-[#1E3A5F] font-mono">Bs {line.subtotal_ves.toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        {d && (
          <div className="shrink-0 border-t border-[#E4E7EB] bg-[#F8FAFC]/60">
            <div className="px-6 pt-4 pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bs</span>
                <span className="text-lg font-bold text-[#1E3A5F] font-mono tracking-tight">Bs {d.total_ves.toFixed(2)}</span>
              </div>
              {d.total_usd > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total USD</span>
                  <span className="text-base font-bold text-slate-700 font-mono">$ {d.total_usd.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider">Tasa de cambio</span>
                <span className="font-semibold text-slate-500 font-mono">
                  {d.tasa_cambio ? `Bs ${d.tasa_cambio.toFixed(2)} / $` : "—"}
                </span>
              </div>
            </div>

            {/* Payment info */}
            {d.transacciones.length > 0 && (() => {
              const t = d.transacciones[0];
              const monedaSymbol = t.moneda === "USD" ? "$" : "Bs";
              const badgeColor = metodoPagoColor[t.metodo_pago] || "bg-slate-100 text-slate-600 border-slate-200";
              return (
                <div className="border-t border-[#E4E7EB] px-6 py-3">
                  <div className="flex items-center gap-2 mb-3">
                    <HiCash size={14} className="text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Información de pago</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${badgeColor}`}>
                      {t.metodo_pago}
                    </span>
                    <span className="font-semibold text-slate-500">
                      {t.moneda}
                    </span>
                    <span className="font-bold text-[#0F172A] font-mono">
                      {monedaSymbol} {t.monto_original.toFixed(2)}
                    </span>
                    {t.monto_ves > 0 && (
                      <span className="font-medium text-slate-400 font-mono">
                        ≈ Bs {t.monto_ves.toFixed(2)}
                      </span>
                    )}
                    {t.descripcion && (
                      <span className="text-slate-400">
                        Ref: <span className="font-semibold text-slate-600">{t.descripcion}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {d.observaciones && (
              <div className="border-t border-[#E4E7EB] px-6 py-3">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Observaciones</span>
                <p className="text-xs font-medium text-slate-600 bg-white rounded-xl px-4 py-2.5 border border-[#E4E7EB] leading-relaxed">
                  {d.observaciones}
                </p>
              </div>
            )}

            <div className="border-t border-[#E4E7EB] px-6 py-3 flex justify-end gap-2">
              {d.url_pdf && (
                <a
                  href={d.url_pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1E3A5F] text-white rounded-xl text-xs font-bold transition-all duration-200"
                >
                  <HiDocumentText size={14} />
                  Ver PDF
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
