"use client";
import {
  HiOutlineExclamationCircle,
  HiOutlineShieldExclamation,
} from "react-icons/hi";
import type { ZReportMode } from "@/modules/cash-register/components/ZReportDialog";
import type { ZReportDayGuardResult } from "@/modules/cash-register/lib/z-report-day-guard";

/**
 * Aviso previo al reporte Z: "ya se emitio un Z hoy en esta maquina fiscal".
 *
 * No bloquea por si solo: muestra la evidencia del Z que ya existe y deja
 * continuar solo con una confirmacion explicita, porque la impresion fisica no
 * se puede deshacer. Tambien cubre el caso "no se pudo verificar".
 */
interface ZReportDayWarningDialogProps {
  result: ZReportDayGuardResult;
  mode: ZReportMode;
  onCancel: () => void;
  onConfirm: () => void;
}

function matchReason(result: ZReportDayGuardResult): string | null {
  if (result.matchedBy === "serial") {
    return "El Z que ya existe hoy salió por esta misma máquina fiscal.";
  }
  if (result.matchedBy === "fallback") {
    return "El Z del día salió por la POS80 porque la máquina fiscal no respondió: el día ya quedó cerrado.";
  }
  if (result.matchedBy === "pharmacy") {
    return "No se pudo identificar esta máquina fiscal, así que se comparó contra todos los reportes Z del día de la farmacia.";
  }
  return null;
}

export default function ZReportDayWarningDialog({
  result,
  mode,
  onCancel,
  onConfirm,
}: ZReportDayWarningDialogProps) {
  const unverified = result.status === "unverified";
  const reason = matchReason(result);
  const nextAction = mode === "print" ? "emitir el segundo Z" : "registrar otro Z";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-2xl ${
                unverified ? "bg-amber-50 text-amber-500" : "bg-red-50 text-red-500"
              }`}
            >
              {unverified ? (
                <HiOutlineExclamationCircle size={28} />
              ) : (
                <HiOutlineShieldExclamation size={28} />
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">
                {unverified
                  ? "No se pudo verificar si ya hay un Z hoy"
                  : "Ya se emitió un reporte Z hoy"}
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-1">
                {unverified
                  ? "Seguí solo si sabés que el día no está cerrado."
                  : `Estás por ${nextAction} en esta caja.`}
              </p>
            </div>
          </div>

          {unverified ? (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-[11px] font-medium text-amber-800/80 leading-relaxed">
                {result.note}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                {result.machineSerial && result.scope === "serial" && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Máquina fiscal
                    </span>
                    <span className="text-sm font-bold text-slate-800 font-mono">
                      {result.machineSerial}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Fecha fiscal
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {result.match?.fiscalDate || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Z ya registrado
                  </span>
                  <span className="text-sm font-black text-red-600">
                    {result.match?.zNumber ? `#${result.match.zNumber}` : "sin número informado"}
                  </span>
                </div>
                {result.todayCount > 1 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Z del día
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {result.todayCount} reportes
                    </span>
                  </div>
                )}
              </div>

              {reason && (
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{reason}</p>
              )}

              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-xs font-black text-red-600 uppercase tracking-wider">
                  Segundo Z del mismo día
                </p>
                <p className="text-[11px] font-medium text-red-800/80 leading-relaxed mt-1">
                  Emitir un Z repetido duplica el cierre y descuadra el libro de ventas. Continuá
                  solo si el Z anterior fue anulado o si soporte lo indicó.
                </p>
              </div>
            </>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-lg"
            >
              No, cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                unverified
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
              }`}
            >
              {unverified ? "Continuar igual" : `Sí, ${nextAction}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
