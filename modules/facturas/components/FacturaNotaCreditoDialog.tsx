"use client";
import { useState, useEffect } from "react";
import {
  HiOutlineXCircle,
  HiOutlineDocumentReport,
  HiOutlineCash,
} from "react-icons/hi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { facturasService } from "../api/facturas.service";
import fiscalPrinterClient from "@/modules/cash-register/api/fiscal-printer-client";
import type { FacturaListItem, FacturaDetail } from "../types";

interface FacturaNotaCreditoDialogProps {
  factura: FacturaListItem;
  onClose: () => void;
  onSuccess: () => void;
  mode?: "legacy" | "tfhka";
}

function parseRif(rif: string): { tipo: string; numero: string } {
  const cleaned = rif.replace(/-/g, "").trim().toUpperCase();
  if (/^[JVE PG]/.test(cleaned)) {
    return { tipo: cleaned[0], numero: cleaned.slice(1) };
  }
  return { tipo: "J", numero: cleaned || "000000000" };
}

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function emitirNotaCreditoFiscal(detail: FacturaDetail, motivo: string): Promise<void> {
  const rif = parseRif(detail.cliente_rif || "");
  const payload = {
    customer: {
      name: detail.cliente_nombre,
      document: `${rif.tipo}${rif.numero}`,
      address: detail.cliente_direccion || "",
    },
    items: detail.detalles.map((d) => ({
      description: d.descripcion,
      quantity: d.cantidad,
      unit_price: d.precio_unitario_ves,
      tax_code:
        (d.iva_porcentaje === 0
          ? "EXENTO"
          : d.iva_porcentaje === 8
            ? "IVA_REDUCIDO"
            : d.iva_porcentaje === 31
              ? "IVA_ADICIONAL"
              : "IVA_GENERAL") as "EXENTO" | "IVA_GENERAL" | "IVA_REDUCIDO" | "IVA_ADICIONAL" | "PERCIBIDO",
      sku: d.producto_id || "",
    })),
    payments: detail.transacciones?.length
      ? detail.transacciones.map((t) => ({
          method: "cash" as const,
          amount: t.monto_original || t.monto_ves,
          currency: (t.moneda === "USD" ? "USD" : "VES") as "VES" | "USD",
          ...(t.moneda === "USD" && t.tasa_cambio ? { exchange_rate: t.tasa_cambio } : {}),
        }))
      : [{ method: "cash" as const, amount: detail.total_ves, currency: "VES" as const }],
    prices_include_tax: true,
    dry_run: false,
    affected_fiscal_number: detail.numero_control,
    affected_invoice_date: detail.fecha_emision
      ? new Date(detail.fecha_emision).toLocaleDateString("es-VE")
      : undefined,
    reason: motivo,
  };
  const result = await fiscalPrinterClient.createCreditNote(payload);
  if (!result.fiscal_number) {
    throw new Error("La impresora fiscal no devolvió número de control");
  }
}

export default function FacturaNotaCreditoDialog({ factura, onClose, onSuccess, mode = "legacy" }: FacturaNotaCreditoDialogProps) {
  const [step, setStep] = useState<"loading" | "form" | "submitting" | "error" | "success">("loading");
  const [detail, setDetail] = useState<FacturaDetail | null>(null);
  const [motivo, setMotivo] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
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
      const ncTotalVes = (detail.detalles ?? []).reduce((sum, d) => {
        const base = (d.cantidad || 0) * (d.precio_unitario_ves || 0);
        return sum + base * (1 + (d.iva_porcentaje || 0) / 100);
      }, 0);
      const totalVes = Math.round(ncTotalVes * 100) / 100;
      const tasa = detail.tasa_cambio > 0 ? detail.tasa_cambio : 1;
      let montoOriginal = moneda === "USD" ? Math.round((totalVes / tasa) * 100) / 100 : totalVes;
      const movimiento = {
        moneda,
        monto_original: montoOriginal,
        tasa_cambio: moneda === "USD" ? tasa : undefined,
        metodo_pago: metodoPago,
        descripcion: undefined,
      };

      if (mode === "tfhka") {
        const rif = parseRif(detail.cliente_rif || "");
        const authProfile = useAuthStore.getState().profile;
        const rifEmisor = (authProfile as any)?.rif || (authProfile as any)?.rifPharmacy || "J-00000000-0";

        await facturasService.createCreditNoteTFHKA({
          id_pharmacy: detail.pharmacy_id,
          rif_emisor: rifEmisor,
          entidad: undefined,
          tasa_cambio: detail.tasa_cambio,
          tracking_id: uuidv4(),
          numero_control_interno: `NC-${Date.now()}`,
          cliente: {
            tipo_identificacion: rif.tipo,
            numero_identificacion: rif.numero,
            razon_social: detail.cliente_nombre,
            direccion: detail.cliente_direccion || "NO DISPONIBLE",
            telefono: "",
            correo: detail.cliente_correo || "NO DISPONIBLE",
          },
          documento_afectado: {
            numero_documento: detail.numero_control,
            fecha_emision: detail.fecha_emision,
            monto_total: totalVes,
            motivo: motivo.trim(),
          },
          items: detail.detalles.map((d) => ({
            descripcion: d.descripcion,
            codigo_plu: d.producto_id || "000",
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario_ves,
            vat: d.iva_porcentaje,
            es_exento: false,
          })),
          sesion_caja_id: detail.sesion_caja_id,
          factura_id: detail.id,
          detalles_persist: detail.detalles.map((d) => ({
            detalle_factura_id: d.id,
            descripcion: d.descripcion,
            cantidad: d.cantidad,
            precio_unitario_ves: d.precio_unitario_ves,
            iva_porcentaje: d.iva_porcentaje,
            subtotal_ves: d.subtotal_ves,
          })),
          movimientos_persist: [movimiento],
        });
      } else {
        await facturasService.createCreditNote({
          factura_id: detail.id,
          sesion_caja_id: detail.sesion_caja_id,
          numero_control: `NC-${Date.now()}`,
          motivo: motivo.trim(),
          tasa_cambio: detail.tasa_cambio,
          observaciones: undefined,
          detalles: detail.detalles.map((d) => ({
            detalle_factura_id: d.id,
            descripcion: d.descripcion,
            cantidad: d.cantidad,
            precio_unitario_ves: d.precio_unitario_ves,
            iva_porcentaje: d.iva_porcentaje,
          })),
          movimientos_caja: [movimiento],
        });
        await emitirNotaCreditoFiscal(detail, motivo.trim());
      }
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
                  <span className="text-slate-400 block">IVA</span>
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
                    <option value="Efectivo">Efectivo</option>
                    <option value="TarjetaDebito">Tarjeta Débito</option>
                    <option value="TarjetaCredito">Tarjeta Crédito</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Biopago">Biopago</option>
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
