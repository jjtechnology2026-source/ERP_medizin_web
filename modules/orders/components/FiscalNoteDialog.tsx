"use client";
import { useState, useMemo } from "react";
import {
  HiOutlineXCircle,
  HiOutlineDocumentReport,
  HiOutlineExclamationCircle,
  HiOutlineOfficeBuilding,
} from "react-icons/hi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { fiscalNotesService } from "@/modules/cash-register/api/fiscal-notes.service";
import type { Order } from "@/modules/orders/types/orders";
import type {
  FiscalNoteItem,
  FiscalNoteCliente,
  FiscalNoteDocumentoAfectado,
} from "@/modules/cash-register/types/fiscal-notes.types";

interface FiscalNoteDialogProps {
  order: Order;
  onClose: () => void;
}

export default function FiscalNoteDialog({ order, onClose }: FiscalNoteDialogProps) {
  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId || profile?.id_group || "";
  const rifEmisor = profile?.rif || order.rifEmisor || "";
  const usesDigitalBilling = profile?.usesDigitalBilling ?? false;

  const [step, setStep] = useState<"form" | "loading" | "result" | "error">("form");
  const [motivo, setMotivo] = useState("");
  const [tasaCambio, setTasaCambio] = useState(order.rate || 1);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultMsg, setResultMsg] = useState("");

  const defaultItems: FiscalNoteItem[] = useMemo(
    () =>
      order.medications.map((m) => ({
        descripcion: m.name || m.brand || "",
        codigo_plu: m.barCode || "",
        cantidad: m.quantity || 0,
        precio_unitario: m.price || 0,
        vat: m.vat || 0,
        es_exento: m.vat === 0,
      })),
    [order.medications]
  );

  const cliente: FiscalNoteCliente = useMemo(
    () => ({
      rif: order.client?.documento || "",
      razon_social: order.client?.name || "Cliente General",
      direccion: order.client?.direccion || "",
      telefono: order.client?.phone || "",
      correo: order.client?.email || "",
    }),
    [order.client]
  );

  const documentoAfectado: FiscalNoteDocumentoAfectado = useMemo(() => {
    const facturacion = order.facturacion;
    return {
      numero_documento:
        facturacion?.resp?.numerocontrol ||
        facturacion?.numero_control ||
        order.id ||
        "",
      fecha_emision: facturacion?.resp?.fecha || order.date || "",
      monto_total: order.totalreal || 0,
      motivo: "",
    };
  }, [order]);

  const buildPayload = () => ({
    id_pharmacy: pharmacyId,
    entidad: "SMART",
    tasa_cambio: tasaCambio,
    rif_emisor: rifEmisor,
    tracking_id: order.id,
    numero_control_interno: `INT-${Date.now()}`,
    cliente,
    documento_afectado: { ...documentoAfectado, motivo },
    items: defaultItems,
    id_order: order.id,
  });

  const handleEmit = async (type: "NC" | "ND") => {
    if (!motivo.trim()) {
      setErrorMsg("El motivo es obligatorio.");
      return;
    }

    setStep("loading");
    const payload = buildPayload();

    const result =
      type === "NC"
        ? await fiscalNotesService.createNotaCredito(payload)
        : await fiscalNotesService.createNotaDebito(payload);

    if (!result.success) {
      setStep("error");
      setErrorMsg(result.message);
      return;
    }

    setStep("result");
    setResultMsg(
      `Nota de ${type === "NC" ? "Crédito" : "Débito"} emitida: ${
        result.response?.numero_control || "OK"
      }`
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
              <HiOutlineDocumentReport size={22} />
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              Emitir Nota Fiscal
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiOutlineXCircle size={22} className="text-slate-400" />
          </button>
        </div>

        {step === "form" && (
          <div className="p-6 space-y-6">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <HiOutlineOfficeBuilding size={16} className="text-slate-500" />
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Datos del cliente</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">RIF</span>
                  <span className="font-bold text-slate-800">{cliente.rif || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Razón Social</span>
                  <span className="font-bold text-slate-800">{cliente.razon_social || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Teléfono</span>
                  <span className="font-bold text-slate-800">{cliente.telefono || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Correo</span>
                  <span className="font-bold text-slate-800">{cliente.correo || "—"}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Documento afectado</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Nro. Documento</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {documentoAfectado.numero_documento}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Fecha emisión</span>
                  <span className="font-bold text-slate-800">
                    {documentoAfectado.fecha_emision
                      ? new Date(documentoAfectado.fecha_emision).toLocaleDateString("es-VE")
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">
                Motivo
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo de la nota fiscal..."
                className="w-full p-3 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[80px] resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">
                Tasa de cambio
              </label>
              <input
                type="number"
                step="0.01"
                value={tasaCambio}
                onChange={(e) => setTasaCambio(parseFloat(e.target.value) || 0)}
                className="w-full p-3 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
                Items ({defaultItems.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {defaultItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-xs bg-white p-2 rounded-xl">
                    <span className="font-bold text-slate-700 truncate flex-1">{item.descripcion}</span>
                    <span className="font-mono text-slate-500 mx-2">x{item.cantidad}</span>
                    <span className="font-bold text-slate-800">Bs {item.precio_unitario.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {!usesDigitalBilling && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-xl text-red-700 text-xs font-bold">
                <HiOutlineExclamationCircle size={16} />
                La facturación digital no está activada. Contacta al administrador.
              </div>
            )}

            {usesDigitalBilling && !motivo.trim() && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl text-amber-700 text-xs font-bold">
                <HiOutlineExclamationCircle size={16} />
                Ingresa el motivo para habilitar la emisión.
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEmit("NC")}
                disabled={!motivo.trim() || !usesDigitalBilling}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-50"
              >
                Emitir NC
              </button>
              <button
                onClick={() => handleEmit("ND")}
                disabled={!motivo.trim() || !usesDigitalBilling}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-50"
              >
                Emitir ND
              </button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-900 border-t-transparent" />
            <p className="text-sm font-bold text-slate-600">Emitiendo nota fiscal...</p>
          </div>
        )}

        {step === "error" && (
          <div className="p-8 flex flex-col items-center gap-6 text-center">
            <div className="p-5 bg-red-50 rounded-full text-red-500">
              <HiOutlineXCircle size={48} />
            </div>
            <p className="text-sm text-slate-500 max-w-md">{errorMsg}</p>
            <button
              onClick={() => setStep("form")}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm"
            >
              Volver
            </button>
          </div>
        )}

        {step === "result" && (
          <div className="p-8 flex flex-col items-center gap-6 text-center">
            <div className="p-5 bg-emerald-50 rounded-full text-emerald-500">
              <HiOutlineDocumentReport size={48} />
            </div>
            <p className="text-sm font-bold text-emerald-700">{resultMsg}</p>
            <button
              onClick={onClose}
              className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
