"use client";
import { useState, useCallback } from "react";
import {
  HiOutlineXCircle,
  HiOutlineDocumentReport,
  HiOutlineExclamationCircle,
  HiOutlineReceiptRefund,
  HiOutlineCalculator,
  HiOutlineOfficeBuilding,
  HiOutlineCash,
  HiOutlineCurrencyDollar,
} from "react-icons/hi";
import { fiscalZReportService } from "@/modules/cash-register/api/fiscal-z-report.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import type { ZReportData, ZReportSession } from "@/modules/cash-register/types/fiscal-z-report.types";

interface ZReportDialogProps {
  onClose: () => void;
}

export default function ZReportDialog({ onClose }: ZReportDialogProps) {
  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId || profile?.id_group || "";
  const rif = profile?.rif || "";

  const [step, setStep] = useState<"confirm" | "loading" | "result" | "error">("confirm");
  const [report, setReport] = useState<ZReportData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!pharmacyId || !rif) {
      setStep("error");
      setErrorMessage("No se pudo resolver la farmacia para generar el reporte Z.");
      return;
    }

    setStep("loading");
    const date = new Date().toISOString().split("T")[0];

    const result = await fiscalZReportService.fetchZReport({
      date,
      idPharmacy: pharmacyId,
      rif,
      entidad: "SMART",
    });

    if (!result.success || !result.report?.data) {
      setStep("error");

      let msg = result.message || "No se pudo generar el reporte Z.";

      if (result.statusCode === 400) {
        msg = `Solicitud incorrecta (400): ${msg}`;
      } else if (result.statusCode === 401) {
        msg = `No autorizado (401): ${msg}. Verifica que tu sesión esté activa.`;
      } else if (result.statusCode === 403) {
        msg = `Acceso denegado (403): ${msg}. No tienes permisos para generar el reporte Z.`;
      } else if (result.statusCode === 404) {
        msg = `No encontrado (404): ${msg}. Verifica que la ruta del endpoint sea correcta.`;
      } else if (result.statusCode === 500) {
        msg = `Error interno del servidor (500): ${msg}. Contacta al administrador.`;
      } else if (result.details) {
        msg = `${msg} (Detalles: ${result.details})`;
      }

      setErrorMessage(msg);
      setErrorDetails(result.details);
      return;
    }

    setReport(result.report.data);
    setStep("result");
  }, [pharmacyId, rif]);

  const displayDate = report?.fechaReporte || report?.fecha || "—";
  const displayBranch = report?.sucursal || report?.caja?.nombre || report?.caja?.codigo || "—";

  const formatDate = (d: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
              <HiOutlineDocumentReport size={22} />
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Reporte Z</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <HiOutlineXCircle size={22} className="text-slate-400" />
          </button>
        </div>

        {/* Confirmation */}
        {step === "confirm" && (
          <div className="p-8 flex flex-col items-center gap-6 text-center">
            <div className="p-5 bg-amber-50 rounded-full text-amber-500">
              <HiOutlineExclamationCircle size={48} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800 mb-2">¿Deseas generar el reporte Z?</p>
              <p className="text-sm text-slate-500 max-w-md">
                Se generará el reporte Z de facturación electrónica para la fecha de hoy.
                Esta acción no afecta el turno actual de caja.
              </p>
            </div>

            <div className="w-full max-w-md bg-slate-50 rounded-2xl p-4 text-left border border-slate-200">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Parámetros de la solicitud</p>
              <div className="space-y-1.5 text-xs font-mono">
                <p><span className="text-slate-400">Fecha:</span> <span className="font-bold text-slate-700">{new Date().toISOString().split("T")[0]}</span></p>
                <p><span className="text-slate-400">RIF:</span> <span className="font-bold text-slate-700">{rif || "—"}</span></p>
                <p><span className="text-slate-400">ID Farmacia:</span> <span className="font-bold text-slate-700">{pharmacyId || "—"}</span></p>
                <p><span className="text-slate-400">Entidad:</span> <span className="font-bold text-slate-700">SMART</span></p>
                <p><span className="text-slate-400">Fact. electrónica:</span> <span className={`font-bold ${profile?.usesDigitalBilling ? "text-emerald-600" : "text-red-600"}`}>{profile?.usesDigitalBilling ? "Activada" : "Desactivada"}</span></p>
                {!profile?.usesDigitalBilling && (
                  <p className="mt-2 pt-2 border-t border-slate-200 text-amber-600 font-bold text-xs">
                    ⚠ La facturación electrónica está desactivada. Consulta con el administrador.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-lg"
              >
                Generar Reporte Z
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {step === "loading" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-900 border-t-transparent" />
            <p className="text-sm font-bold text-slate-600">Generando reporte Z...</p>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="p-8 flex flex-col items-center gap-6 text-center">
            <div className="p-5 bg-red-50 rounded-full text-red-500">
              <HiOutlineXCircle size={48} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800 mb-2">Error</p>
              <p className="text-sm text-slate-500 max-w-md">{errorMessage}</p>
            </div>

            <div className="w-full max-w-md bg-slate-50 rounded-2xl p-4 text-left border border-slate-200">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Diagnóstico</p>
              <div className="space-y-1.5 text-xs font-mono">
                <p><span className="text-slate-400">Fact. electrónica:</span> <span className={`font-bold ${profile?.usesDigitalBilling ? "text-emerald-600" : "text-red-600"}`}>{profile?.usesDigitalBilling ? "Activada" : "Desactivada"}</span></p>
                <p><span className="text-slate-400">RIF:</span> <span className="font-bold text-slate-700">{rif || "—"}</span></p>
                <p><span className="text-slate-400">ID Farmacia:</span> <span className="font-bold text-slate-700">{pharmacyId || "—"}</span></p>
                {errorDetails && (
                  <p className="mt-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-400">Respuesta backend:</span>{" "}
                    <span className="font-bold text-red-600 break-all">{errorDetails}</span>
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Report Detail */}
        {step === "result" && report && (
          <div className="p-6 space-y-6">
            {/* Company info */}
            {report.empresa && (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <HiOutlineOfficeBuilding size={18} className="text-slate-500" />
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Empresa</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Razón Social</span>
                    <span className="text-sm font-bold text-slate-800">{report.empresa.razonSocial}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RIF</span>
                    <span className="text-sm font-bold text-slate-800">{report.empresa.rif}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha Reporte</span>
                    <span className="text-sm font-bold text-slate-800">{displayDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sucursal</span>
                    <span className="text-sm font-bold text-slate-800">{displayBranch}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Fiscal Summary */}
            {report.reporteZ && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <HiOutlineReceiptRefund size={18} className="text-slate-500" />
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Resumen Fiscal</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total Venta</span>
                    <span className="text-lg font-black text-emerald-700">Bs {report.reporteZ.totalVenta}</span>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Base</span>
                    <span className="text-lg font-black text-blue-700">Bs {report.reporteZ.ventaBase}</span>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">IVA</span>
                    <span className="text-lg font-black text-purple-700">Bs {report.reporteZ.ventaIva}</span>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Total Z</span>
                    <span className="text-lg font-black text-amber-700">Bs {report.reporteZ.totalZ}</span>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Devoluciones</span>
                    <span className="text-lg font-black text-red-700">Bs {report.reporteZ.totalDevol}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">IGTF</span>
                    <span className="text-lg font-black text-slate-700">Bs {report.reporteZ.totalIgtf}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Nro Control Inicial</span>
                    <span className="text-lg font-black text-slate-700">{report.reporteZ.nroControlInicial}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Nro Control Final</span>
                    <span className="text-lg font-black text-slate-700">{report.reporteZ.nroControlFinal}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-bold">Facturas:</span>
                  <span className="font-black text-slate-800">{report.reporteZ.totalFacturas}</span>
                  <span className="mx-2">|</span>
                  <span className="font-bold">Diferencia Z:</span>
                  <span className="font-black text-slate-800">Bs {report.reporteZ.difZ}</span>
                </div>
              </div>
            )}

            {/* Cash Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.totalVentas && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <HiOutlineCash size={16} className="text-emerald-500" />
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Ventas</h3>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">VES</span>
                      <span className="text-xl font-black text-emerald-600">Bs {report.totalVentas.ves.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">USD</span>
                      <span className="text-xl font-black text-blue-600">$ {report.totalVentas.usd.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              {report.totalGastos && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <HiOutlineCalculator size={16} className="text-red-500" />
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Gastos</h3>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">VES</span>
                      <span className="text-xl font-black text-red-600">Bs {report.totalGastos.ves.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">USD</span>
                      <span className="text-xl font-black text-blue-600">$ {report.totalGastos.usd.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fondo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {report.fondoInicial && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Fondo Inicial</span>
                  <div className="flex gap-3 text-sm font-bold">
                    <span className="text-slate-800">Bs {report.fondoInicial.ves.toFixed(2)}</span>
                    <span className="text-blue-600">$ {report.fondoInicial.usd.toFixed(2)}</span>
                  </div>
                </div>
              )}
              {report.fondoFinal && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Fondo Final</span>
                  <div className="flex gap-3 text-sm font-bold">
                    <span className="text-slate-800">Bs {report.fondoFinal.ves.toFixed(2)}</span>
                    <span className="text-blue-600">$ {report.fondoFinal.usd.toFixed(2)}</span>
                  </div>
                </div>
              )}
              {report.diferenciaAcumulada && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Diferencia Acumulada</span>
                  <div className="flex gap-3 text-sm font-bold">
                    <span className={report.diferenciaAcumulada.ves >= 0 ? "text-emerald-600" : "text-red-600"}>
                      Bs {report.diferenciaAcumulada.ves.toFixed(2)}
                    </span>
                    <span className={report.diferenciaAcumulada.usd >= 0 ? "text-emerald-600" : "text-red-600"}>
                      $ {report.diferenciaAcumulada.usd.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Sessions */}
            {report.detalleSesiones.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <HiOutlineCurrencyDollar size={16} className="text-slate-500" />
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                      Detalle de Sesiones ({report.cantidadTurnos} turnos)
                    </h3>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {report.detalleSesiones.map((s: ZReportSession, i: number) => (
                    <div key={s.id || i} className="p-5 hover:bg-slate-50 transition-colors">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sesión</span>
                          <span className="font-mono font-bold text-slate-700 text-xs">{s.id || "—"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Apertura</span>
                          <span className="font-bold text-slate-800">{formatDate(s.fechaApertura)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cierre</span>
                          <span className="font-bold text-slate-800">{s.fechaCierre ? formatDate(s.fechaCierre) : "—"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estado</span>
                          <span className={`font-bold ${s.estado === "cerrada" ? "text-slate-800" : "text-emerald-600"}`}>
                            {s.estado}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ventas VES</span>
                          <span className="font-mono font-bold text-slate-800">Bs {s.totalVentasVes.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ventas USD</span>
                          <span className="font-mono font-bold text-blue-600">$ {s.totalVentasUsd.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gastos VES</span>
                          <span className="font-mono font-bold text-red-600">Bs {s.totalGastosVes.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Diferencia</span>
                          <span className={`font-mono font-bold ${s.diferenciaVes >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            Bs {s.diferenciaVes.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
