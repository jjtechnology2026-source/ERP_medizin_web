"use client";
import { useEffect, useState } from "react";
import {
  HiOutlineXCircle,
  HiOutlineDocumentReport,
  HiOutlineExternalLink,
  HiOutlineCash,
  HiOutlineCalculator,
  HiOutlineClipboardCheck,
} from "react-icons/hi";
import { fiscalNotesService } from "@/modules/cash-register/api/fiscal-notes.service";
import type { FiscalNoteDetail } from "@/modules/cash-register/types/fiscal-notes.types";

interface FiscalNoteDetailDialogProps {
  noteId: string;
  noteType: "NC";
  onClose: () => void;
}

export default function FiscalNoteDetailDialog({ noteId, noteType, onClose }: FiscalNoteDetailDialogProps) {
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<FiscalNoteDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDetail();
  }, [noteId, noteType]);

  const loadDetail = async () => {
    setLoading(true);
    const result =
      noteType === "NC"
        ? await fiscalNotesService.getNotaCredito(noteId)
        : await fiscalNotesService.getNotaDebito(noteId);

    if (!result.success || !result.item) {
      setError(result.message || "No se pudo cargar el detalle");
      setLoading(false);
      return;
    }

    setNote(result.item);
    setLoading(false);
  };

  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("es-VE", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl text-white ${noteType === "NC" ? "bg-amber-500" : "bg-red-500"}`}>
              <HiOutlineDocumentReport size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Nota de {noteType === "NC" ? "Crédito" : "Débito"}
              </h2>
              {note?.numero_control && (
                <span className="text-xs font-bold text-slate-400 font-mono">{note.numero_control}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiOutlineXCircle size={22} className="text-slate-400" />
          </button>
        </div>

        {loading && (
          <div className="p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-900 border-t-transparent" />
            <p className="text-sm font-bold text-slate-500">Cargando detalle...</p>
          </div>
        )}

        {error && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="p-5 bg-red-50 rounded-full text-red-500">
              <HiOutlineXCircle size={48} />
            </div>
            <p className="text-sm text-slate-500">{error}</p>
            <button onClick={onClose} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">
              Cerrar
            </button>
          </div>
        )}

        {note && (
          <div className="p-6 space-y-5">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl ${
              note.fiscal_success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}>
              <HiOutlineClipboardCheck size={18} />
              <span className="text-xs font-black uppercase tracking-wider">
                {note.fiscal_success ? "Emitida correctamente" : "Error en emisión"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tracking ID" value={note.tracking_id} />
              <Field label="Fecha emisión" value={formatDate(note.fecha_emision)} />
              <Field label="Motivo" value={note.motivo} full />
              <Field label="Observaciones" value={note.observaciones} full />
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <HiOutlineCash size={14} />
                Montos
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Base imponible" value={`Bs ${note.base_imponible_ves.toFixed(2)}`} />
                <Field label={`IVA (${note.iva_porcentaje}%)`} value={`Bs ${note.iva_monto_ves.toFixed(2)}`} />
                <Field label="Total VES" value={`Bs ${note.total_ves.toFixed(2)}`} />
                <Field label="Total USD" value={`$ ${note.total_usd.toFixed(2)}`} />
                <Field label="Tasa de cambio" value={note.tasa_cambio?.toFixed(2)} />
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <HiOutlineCalculator size={14} />
                Referencias
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Order ID" value={note.order_id} mono />
                <Field label="Factura ID" value={note.factura_id} mono />
                <Field label="Pharmacy ID" value={note.pharmacy_id} mono />
              </div>
            </div>

            {note.fiscal_error && (
              <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-wider block mb-1">
                  Error fiscal
                </span>
                <p className="text-xs text-red-700 font-mono">{note.fiscal_error}</p>
              </div>
            )}

            {note.url_pdf && (
              <a
                href={note.url_pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all"
              >
                <HiOutlineExternalLink size={16} />
                Ver PDF fiscal
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const Field = ({ label, value, full, mono }: { label: string; value?: string | null; full?: boolean; mono?: boolean }) => (
  <div className={full ? "col-span-2" : ""}>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
    <span className={`text-sm font-bold text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>
      {value || "—"}
    </span>
  </div>
);
