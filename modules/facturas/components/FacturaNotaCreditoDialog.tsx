"use client";
import { useState, useEffect } from "react";
import {
  HiOutlineXCircle,
  HiOutlineDocumentReport,
  HiOutlineCash,
} from "react-icons/hi";
import { facturasService } from "../api/facturas.service";
import type { FacturaListItem, FacturaDetail } from "../types";

interface FacturaNotaCreditoDialogProps {
  factura: FacturaListItem;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FacturaNotaCreditoDialog({ factura, onClose, onSuccess }: FacturaNotaCreditoDialogProps) {
  const [step, setStep] = useState<"loading" | "form" | "submitting" | "error" | "success">("loading");
  const [detail, setDetail] = useState<FacturaDetail | null>(null);
  const [motivo, setMotivo] = useState("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [moneda, setMoneda] = useState("VES");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    facturasService.detail(factura.id)
      .then(setDetail)
      .then(() => setStep("form"))
      .catch(() => {
        setErrorMsg("No se pudo cargar el detalle de la factura");
        setStep("error");
      });
  }, [factura.id]);

  const handleEmit = async () => {
    if (!detail) return;
    if (!motivo.trim()) {
      setErrorMsg("El motivo es obligatorio");
      return;
    }

    setStep("submitting");
    try {
      const montoOriginal = moneda === "USD" ? detail.total_usd : detail.total_ves;
      await facturasService.createCreditNote({
        factura_id: detail.id,
        sesion_caja_id: detail.sesion_caja_id,
        numero_control: `NC-${Date.now()}`,
        motivo: motivo.trim(),
        tasa_cambio: detail.tasa_cambio,
        detalles: detail.detalles.map((d) => ({
          detalle_factura_id: d.id,
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precio_unitario_ves: d.precio_unitario_ves,
          iva_porcentaje: d.iva_porcentaje,
        })),
        movimientos_caja: [{
          moneda,
          monto_original: montoOriginal,
          tasa_cambio: moneda === "USD" ? detail.tasa_cambio : undefined,
          metodo_pago: metodoPago,
        }],
      });
      setSuccessMsg("Nota de crédito emitida correctamente");
      setStep("success");
      setTimeout(onSuccess, 1500);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.message || e.message || "Error al emitir nota de crédito");
      setStep("error");
    }
  };

  const formatMoney = (n: number) => n.toFixed(2);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[32px] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in duration-200">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-[#E4E7EB]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
              <HiOutlineDocumentReport size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Emitir Nota de Crédito</h2>
              <span className="text-xs font-semibold text-slate-400 font-mono">{factura.numero_control}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F1F3F5] rounded-xl transition-all duration-200">
            <HiOutlineXCircle size={22} className="text-slate-400" />
          </button>
        </div>

        {step === "loading" && (
          <div className="p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#E4E7EB] border-t-[#1E3A5F]" />
            <p className="text-sm font-bold text-slate-400">Cargando detalle...</p>
          </div>
        )}

        {step === "error" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="p-5 bg-red-50 rounded-full text-red-500">
              <HiOutlineXCircle size={48} />
            </div>
            <p className="text-sm text-slate-500">{errorMsg}</p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-[#1E3A5F] hover:bg-[#0F172A] text-white rounded-xl font-bold text-sm transition-all duration-200"
            >
              Cerrar
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="p-5 bg-[#059669]/10 rounded-full text-[#059669]">
              <HiOutlineDocumentReport size={48} />
            </div>
            <p className="text-sm font-bold text-[#059669]">{successMsg}</p>
          </div>
        )}

        {(step === "form" || step === "submitting") && detail && (
          <div className="p-6 space-y-5">
            <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E4E7EB]">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Datos de la factura</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Cliente</span>
                  <span className="font-bold text-[#0F172A]">{detail.cliente_nombre}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">RIF</span>
                  <span className="font-bold text-slate-700 font-mono">{detail.cliente_rif || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Total VES</span>
                  <span className="font-bold text-[#1E3A5F] font-mono">Bs {formatMoney(detail.total_ves)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Total USD</span>
                  <span className="font-bold text-slate-700 font-mono">$ {formatMoney(detail.total_usd)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Base imponible</span>
                  <span className="font-bold text-slate-700 font-mono">Bs {formatMoney(detail.base_imponible_ves)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">IVA ({detail.iva_porcentaje}%)</span>
                  <span className="font-bold text-slate-700 font-mono">Bs {formatMoney(detail.iva_monto_ves)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Motivo de la nota de crédito
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Describí el motivo de la nota de crédito..."
                className="w-full p-3 text-sm font-semibold bg-[#F8FAFC] border border-[#E4E7EB] rounded-xl outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 min-h-[80px] resize-none placeholder:text-slate-300"
              />
            </div>

            <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E4E7EB]">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <HiOutlineCash size={14} />
                Información de pago para la NC
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Método de pago
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="w-full p-2.5 text-xs font-semibold bg-white border border-[#E4E7EB] rounded-xl outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="PUNTO_DE_VENTA">Punto de Venta</option>
                    <option value="ZELLE">Zelle</option>
                    <option value="PAGOMOVIL">Pago Móvil</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Moneda
                  </label>
                  <select
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value)}
                    className="w-full p-2.5 text-xs font-semibold bg-white border border-[#E4E7EB] rounded-xl outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
                  >
                    <option value="VES">VES (Bs)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E4E7EB]">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <HiOutlineCash size={14} />
                Items de la factura original ({detail.detalles.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detail.detalles.map((d, i) => (
                  <div key={d.id || i} className="flex justify-between items-center text-xs bg-white p-3 rounded-xl border border-[#E4E7EB]/50">
                    <span className="font-semibold text-slate-700 truncate flex-1">{d.descripcion}</span>
                    <span className="font-mono text-slate-400 mx-3">x{d.cantidad}</span>
                    <span className="font-bold text-[#1E3A5F]">Bs {formatMoney(d.subtotal_ves)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[#F8FAFC] hover:bg-[#F1F3F5] text-slate-600 rounded-xl font-bold text-xs transition-all duration-200 border border-[#E4E7EB]"
              >
                Cancelar
              </button>
              <button
                onClick={handleEmit}
                disabled={!motivo.trim() || step === "submitting"}
                className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl font-bold text-xs transition-all duration-200 shadow-sm disabled:opacity-50 disabled:hover:bg-[#059669]"
              >
                {step === "submitting" ? "Emitiendo..." : "Emitir NC"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
