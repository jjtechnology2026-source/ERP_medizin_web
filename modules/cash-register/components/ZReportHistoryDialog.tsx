"use client";
import { useState, useEffect, useCallback } from "react";
import {
  HiOutlineXCircle,
  HiOutlineDocumentReport,
  HiOutlineSearch,
  HiOutlineArrowLeft,
} from "react-icons/hi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { fiscalZReportService } from "@/modules/cash-register/api/fiscal-z-report.service";
import type { ZReportListItem, CreatedZReport } from "@/modules/cash-register/types/fiscal-z-report.types";

interface ZReportHistoryDialogProps {
  onClose: () => void;
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `Bs ${value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-VE", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return d;
  }
}

function formatDateTime(d: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-ES", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return d;
  }
}

export default function ZReportHistoryDialog({ onClose }: ZReportHistoryDialogProps) {
  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId || profile?.id_group || "";

  const [reports, setReports] = useState<ZReportListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [selectedReport, setSelectedReport] = useState<CreatedZReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const fetchList = useCallback(async () => {
    if (!pharmacyId) return;
    setLoading(true);
    setError("");
    const result = await fiscalZReportService.fetchZReportList({
      idPharmacy: pharmacyId,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
    });
    if (!result.success) {
      setError(result.message);
    } else {
      setReports(result.reports);
    }
    setLoading(false);
  }, [pharmacyId, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchList();
  }, []);

  const handleViewDetail = useCallback(async (reportId: string) => {
    if (!pharmacyId) return;
    setDetailLoading(true);
    setDetailError("");
    setSelectedReport(null);
    const result = await fiscalZReportService.getZReport(pharmacyId, reportId);
    if (!result.success || !result.report) {
      setDetailError(result.message || "No se pudo obtener el detalle del reporte Z");
    } else {
      setSelectedReport(result.report);
    }
    setDetailLoading(false);
  }, [pharmacyId]);

  const handleBack = useCallback(() => {
    setSelectedReport(null);
    setDetailError("");
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {selectedReport ? (
              <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <HiOutlineArrowLeft size={20} className="text-slate-500" />
              </button>
            ) : (
              <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
                <HiOutlineDocumentReport size={22} />
              </div>
            )}
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {selectedReport ? `Reporte Z #${selectedReport.zNumber}` : "Historial de Reportes Z"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiOutlineXCircle size={22} className="text-slate-400" />
          </button>
        </div>

        {selectedReport ? (
          <div className="p-6 space-y-5">
            {detailError && (
              <div className="p-4 bg-red-50 rounded-2xl text-red-700 text-sm font-bold text-center">
                {detailError}
              </div>
            )}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
              <p className="text-sm font-black text-emerald-700">Reporte Z registrado</p>
              <p className="text-xs font-bold text-emerald-600/80 mt-1">
                Z #{selectedReport.zNumber} · {selectedReport.fiscalDate || "—"}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Datos fiscales</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Serial</span>
                  <span className="font-bold text-slate-800">{selectedReport.fiscalSerial || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ID</span>
                  <span className="font-mono text-xs font-bold text-slate-700">{selectedReport.id || "—"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">Totales del día (backend)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Ventas totales</span>
                  <span className="text-base font-black text-emerald-700">{formatMoney(selectedReport.totalSales)}</span>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Base imponible</span>
                  <span className="text-base font-black text-blue-700">{formatMoney(selectedReport.taxedSales)}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Exento</span>
                  <span className="text-base font-black text-slate-700">{formatMoney(selectedReport.exemptSales)}</span>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Contribuyentes</span>
                  <span className="text-base font-black text-amber-700">
                    {selectedReport.taxpayers ?? "—"} / {selectedReport.nonTaxpayers ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            {selectedReport.invoices && (
              <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Facturas</p>
                <p className="font-bold text-slate-800">
                  {selectedReport.invoices.count} docs · {selectedReport.invoices.docFrom} → {selectedReport.invoices.docTo}
                </p>
              </div>
            )}

            {(selectedReport.creditNotes || selectedReport.debitNotes) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {selectedReport.creditNotes && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Notas de crédito</p>
                    <p className="font-bold text-slate-800">
                      {selectedReport.creditNotes.count}
                      {selectedReport.creditNotes.total != null ? ` · ${formatMoney(selectedReport.creditNotes.total)}` : ""}
                    </p>
                  </div>
                )}
                {selectedReport.debitNotes && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Notas de débito</p>
                    <p className="font-bold text-slate-800">
                      {selectedReport.debitNotes.count}
                      {selectedReport.debitNotes.total != null ? ` · ${formatMoney(selectedReport.debitNotes.total)}` : ""}
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedReport.taxWithholdingsCount != null && (
              <p className="text-xs font-bold text-slate-500">
                Retenciones IVA: <span className="text-slate-800">{selectedReport.taxWithholdingsCount}</span>
              </p>
            )}

            <div className="flex justify-between pt-1">
              <button onClick={handleBack} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all">
                Volver al historial
              </button>
              <button onClick={onClose} className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-lg">
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="flex items-end gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Desde</label>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                  className="p-2.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Hasta</label>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                  className="p-2.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <button onClick={fetchList} className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all">
                <HiOutlineSearch size={20} />
              </button>
            </div>

            {loading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-900 border-t-transparent" />
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 rounded-2xl text-red-700 text-sm font-bold text-center">{error}</div>
            )}

            {!loading && !error && reports.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm font-bold">No hay reportes Z registrados.</div>
            )}

            {!loading && reports.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="p-4 text-left">Fecha</th>
                      <th className="p-4 text-left">Z #</th>
                      <th className="p-4 text-right">Total Ventas</th>
                      <th className="p-4 text-right">Facturas</th>
                      <th className="p-4 text-left">Sucursal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => handleViewDetail(r.id)}
                      >
                        <td className="p-4 font-bold text-slate-800">{formatDate(r.fiscalDate)}</td>
                        <td className="p-4 font-mono font-bold text-slate-700">
                          {r.zNumber != null ? `#${r.zNumber}` : "—"}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-600">{formatMoney(r.totalSales)}</td>
                        <td className="p-4 text-right font-bold text-slate-700">
                          {r.invoiceCount != null ? r.invoiceCount : "—"}
                        </td>
                        <td className="p-4 font-bold text-slate-600">{r.sucursal || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={onClose} className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {detailLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-3xl">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-900 border-t-transparent" />
              <p className="text-sm font-bold text-slate-600">Cargando detalle...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
