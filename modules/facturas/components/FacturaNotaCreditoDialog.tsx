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
import { toBs2, reconcileFiscalTotal } from "@/modules/cash-register/lib/money";
import { mapVatToTaxCode } from "@/modules/cash-register/lib/fiscal-payload";
import {
  NO_FISCAL_LEGEND,
  buildFallbackNote,
} from "@/modules/cash-register/lib/fiscal-fallback";
import { printNoFiscalTicket, prepairPrinter } from "@/modules/cash-register/lib/pos58-print";
import type { TicketHeader } from "@/modules/cash-register/lib/pos58-ticket";
import {
  decideNotaCreditoOutcome,
  type NotaCreditoDecision,
} from "../lib/nota-credito-flow";
import type { FacturaListItem, FacturaDetail } from "../types";

interface FacturaNotaCreditoDialogProps {
  factura: FacturaListItem;
  onClose: () => void;
  onSuccess: () => void;
  mode?: "legacy" | "tfhka";
}

type Step = "loading" | "form" | "submitting" | "error" | "success" | "stored-not-printed";

interface StoredPrintContext {
  total: number;
  affectedDocument: string;
  reason: string;
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

function formatTicketDate(input: string): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
      // precio_unitario_ves viene como BASE sin IVA desde la BD: lo llevamos a
      // CON IVA (2 decimales) para respetar la convencion unica del sistema fiscal.
      unit_price: toBs2(d.precio_unitario_ves * (1 + (d.iva_porcentaje || 0) / 100)),
      // Un IVA nulo/ausente de la BD cae al default 0 -> EXENTO (y un 0 explícito también).
      tax_code: mapVatToTaxCode(d.iva_porcentaje),
      sku: d.producto_id || "",
    })),
    payments: detail.transacciones?.length
      ? detail.transacciones.map((t) => ({
          method: "cash" as const,
          amount: toBs2(t.monto_original || t.monto_ves),
          currency: (t.moneda === "USD" ? "USD" : "VES") as "VES" | "USD",
          ...(t.moneda === "USD" && t.tasa_cambio ? { exchange_rate: t.tasa_cambio } : {}),
        }))
      : [{ method: "cash" as const, amount: toBs2(detail.total_ves), currency: "VES" as const }],
    prices_include_tax: true,
    dry_run: false,
    affected_fiscal_number: detail.numero_control,
    affected_invoice_date: detail.fecha_emision
      ? new Date(detail.fecha_emision).toLocaleDateString("es-VE")
      : undefined,
    reason: motivo,
  };
  const result = await fiscalPrinterClient.createCreditNote(payload);
  const recon = reconcileFiscalTotal(result.total, payload.items);
  if (recon) console.error("❌ [FacturaNotaCreditoDialog]", recon);
  if (!result.fiscal_number) {
    throw new Error("La impresora fiscal no devolvió número de control");
  }
}

export default function FacturaNotaCreditoDialog({ factura, onClose, onSuccess, mode = "legacy" }: FacturaNotaCreditoDialogProps) {
  const [step, setStep] = useState<Step>("loading");
  const [detail, setDetail] = useState<FacturaDetail | null>(null);
  const [motivo, setMotivo] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [moneda, setMoneda] = useState("VES");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorHint, setErrorHint] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [storedContext, setStoredContext] = useState<StoredPrintContext | null>(null);
  const [storedReason, setStoredReason] = useState("");
  const [printState, setPrintState] = useState<"idle" | "printing" | "printed" | "failed">("idle");
  const [printError, setPrintError] = useState("");

  useEffect(() => {
    facturasService.detail(factura.id)
      .then(setDetail)
      .then(() => setStep("form"))
      .catch(() => {
        setErrorMsg("No se pudo cargar el detalle de la factura");
        setErrorHint("");
        setStep("error");
      });
  }, [factura.id]);

  const applyDecision = (decision: NotaCreditoDecision, context: StoredPrintContext) => {
    if (decision.step === "emitted-not-persisted") {
      // El documento fiscal ya existe pero nada se guardo: no se imprime, no se
      // ofrece "No Fiscal" y no se refresca la tabla como si se hubiera guardado.
      setErrorMsg(decision.message);
      setErrorHint(
        "El comprobante fiscal ya existe: no vuelva a emitir la nota. Contacte a soporte para regularizar la persistencia y la devolución del stock.",
      );
      setStep("error");
      return;
    }
    if (decision.step === "error") {
      setErrorMsg(decision.message);
      setErrorHint("No se guardó la nota de crédito ni se imprimió ningún comprobante.");
      setStep("error");
      return;
    }
    if (decision.step === "stored-not-printed") {
      setStoredContext(context);
      setStoredReason(decision.reason ?? "");
      setPrintState("idle");
      setPrintError("");
      setStep("stored-not-printed");
      // La NC ya se guardó (y el stock ya se devolvió): refrescamos la tabla sin
      // cerrar el diálogo, para que el operador pueda imprimir el "No Fiscal".
      onSuccess();
      return;
    }
    setSuccessMsg(decision.message);
    setStep("success");
    setTimeout(onSuccess, 1500);
  };

  const handleEmit = async () => {
    if (!detail) return;
    if (!motivo.trim()) {
      setErrorMsg("El motivo es obligatorio");
      return;
    }

    // En el mismo gesto del click: WebUSB exige activacion para pedir la POS80.
    await prepairPrinter();
    setStep("submitting");

    const ncTotalVes = (detail.detalles ?? []).reduce((sum, d) => {
      const base = (d.cantidad || 0) * (d.precio_unitario_ves || 0);
      return sum + base * (1 + (d.iva_porcentaje || 0) / 100);
    }, 0);
    const totalVes = Math.round(ncTotalVes * 100) / 100;
    const tasa = detail.tasa_cambio > 0 ? detail.tasa_cambio : 1;
    const montoOriginal = moneda === "USD" ? Math.round((totalVes / tasa) * 100) / 100 : totalVes;
    const movimiento = {
      moneda,
      monto_original: montoOriginal,
      tasa_cambio: moneda === "USD" ? tasa : undefined,
      metodo_pago: metodoPago,
      descripcion: undefined,
    };
    const context: StoredPrintContext = {
      total: totalVes,
      affectedDocument: detail.numero_control,
      reason: motivo.trim(),
    };

    if (mode === "tfhka") {
      const rif = parseRif(detail.cliente_rif || "");
      const authProfile = useAuthStore.getState().profile;
      const rifEmisor = (authProfile as any)?.rif || (authProfile as any)?.rifPharmacy || "J-00000000-0";

      const tfhkaPayload = {
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
      };

      try {
        const outcome = await facturasService.createCreditNoteTFHKA(tfhkaPayload);
        applyDecision(
          decideNotaCreditoOutcome({
            persisted: outcome.persisted,
            persistError: outcome.persistError,
            fiscallyEmitted: true,
            printed: true,
          }),
          context,
        );
      } catch (e) {
        // Fallo de transporte/HTTP: nada se emitio ni se persistio; error real
        // del backend, sin imprimir.
        console.error("❌ [FacturaNotaCreditoDialog] Persistencia TFHKA de la NC falló:", e);
        applyDecision(decideNotaCreditoOutcome({ persisted: false, persistError: e }), context);
      }
      return;
    }

    const localPayload = {
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
    };

    // Legacy: SIEMPRE primero persistir. Si falla, no hay exito ni impresion.
    try {
      await facturasService.createCreditNote(localPayload);
    } catch (e) {
      console.error("❌ [FacturaNotaCreditoDialog] Persistencia de la NC falló:", e);
      applyDecision(decideNotaCreditoOutcome({ persisted: false, persistError: e }), context);
      return;
    }

    // Solo con la NC ya guardada se intenta la impresora fiscal. Si falla, la
    // nota queda guardada (y el stock devuelto) y se ofrece el "No Fiscal" bajo
    // demanda con un click explícito; nunca se imprime solo.
    try {
      await emitirNotaCreditoFiscal(detail, motivo.trim());
    } catch (e) {
      console.error("❌ [FacturaNotaCreditoDialog] Impresión fiscal de la NC falló:", e);
      applyDecision(
        decideNotaCreditoOutcome({ persisted: true, printed: false, printError: e }),
        context,
      );
      return;
    }
    applyDecision(decideNotaCreditoOutcome({ persisted: true, printed: true }), context);
  };

  const handlePrintNoFiscal = async () => {
    if (!detail || !storedContext) return;
    setPrintState("printing");
    setPrintError("");

    const note = buildFallbackNote();
    const profileData = useAuthStore.getState().profile;
    const header: TicketHeader = {
      name: String(profileData?.pharmacyName || profileData?.name_group || profileData?.name || ""),
      rif: String(profileData?.rif || ""),
      address: String(profileData?.pharmacyAddress || ""),
      phone: String(profileData?.pharmacyPhone || ""),
    };

    const result = await printNoFiscalTicket({
      kind: "credit-note",
      header,
      title: "NOTA DE CREDITO NO FISCAL",
      controlNumber: note.numero_control,
      trackingId: note.tracking_id,
      date: formatTicketDate(note.fecha),
      customerName: detail.cliente_nombre || "Cliente General",
      customerDoc: detail.cliente_rif || "V-00000000",
      affectedDoc: storedContext.affectedDocument,
      reason: storedContext.reason || undefined,
      total: storedContext.total,
      legend: "NO FISCAL",
    });

    if (result.printed) {
      setPrintState("printed");
      return;
    }
    setPrintState("failed");
    setPrintError(result.error || "No se pudo imprimir en la POS80");
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
            <p className="text-sm font-bold text-slate-400">Cargando el detalle de la factura...</p>
          </div>
        )}

        {step === "error" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="p-5 bg-red-50 rounded-full text-red-500">
              <HiOutlineXCircle size={48} />
            </div>
            <p className="text-sm font-bold text-red-600 max-w-md">{errorMsg}</p>
            {errorHint && (
              <p className="text-xs text-slate-400 max-w-md">{errorHint}</p>
            )}
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
            <div className="p-5 rounded-full bg-[#059669]/10 text-[#059669]">
              <HiOutlineDocumentReport size={48} />
            </div>
            <p className="text-sm font-bold text-[#059669]">{successMsg}</p>
          </div>
        )}

        {step === "stored-not-printed" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="p-5 bg-amber-50 rounded-full text-amber-500">
              <HiOutlineDocumentReport size={48} />
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-black">
              {NO_FISCAL_LEGEND}
            </span>
            <p className="text-sm font-bold text-amber-700 max-w-md">{successMsg}</p>
            {storedReason && (
              <p className="text-[11px] text-slate-400 max-w-md">
                Detalle de la impresora: {storedReason}
              </p>
            )}
            {printState === "printed" && (
              <p className="text-xs font-bold text-[#059669]">
                Comprobante No Fiscal impreso en la POS80.
              </p>
            )}
            {printState === "failed" && (
              <p className="text-xs font-bold text-red-500 max-w-md">
                No se pudo imprimir el comprobante No Fiscal: {printError || "intente nuevamente"}.
              </p>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[#F8FAFC] hover:bg-[#F1F3F5] text-slate-600 rounded-xl font-bold text-xs transition-all duration-200 border border-[#E4E7EB]"
              >
                Cerrar
              </button>
              <button
                onClick={handlePrintNoFiscal}
                disabled={printState === "printing" || printState === "printed"}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs transition-all duration-200 shadow-sm disabled:opacity-50 disabled:hover:bg-amber-500"
              >
                {printState === "printing"
                  ? "Imprimiendo..."
                  : printState === "printed"
                    ? "Impreso"
                    : "Imprimir comprobante No Fiscal"}
              </button>
            </div>
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
                Información de pago de la nota de crédito
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
                Ítems de la factura original ({detail.detalles.length})
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
                {step === "submitting" ? "Emitiendo..." : "Emitir nota de crédito"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
