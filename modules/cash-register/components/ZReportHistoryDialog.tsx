"use client";
import { useState, useEffect, useCallback } from "react";
import {
  HiOutlineXCircle,
  HiOutlineDocumentReport,
  HiOutlineCalendar,
  HiOutlineSearch,
} from "react-icons/hi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { fiscalZReportService } from "@/modules/cash-register/api/fiscal-z-report.service";
import type { ZReportListItem } from "@/modules/cash-register/types/fiscal-z-report.types";

interface ZReportHistoryDialogProps {
  onClose: () => void;
}

export default function ZReportHistoryDialog({ onClose }: ZReportHistoryDialogProps) {
  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId || profile?.id_group || "";

  const [reports, setReports] = useState<ZReportListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

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

  const formatDate = (d: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("es-VE", {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return d;
    }
  };

  const formatCurrency = (v: number | null) => {
    if (v == null) return "—";
    return `Bs ${v.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
              <HiOutlineDocumentReport size={22} />
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Historial de Reportes Z</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiOutlineXCircle size={22} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-end gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="p-2.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="p-2.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={fetchList}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all"
            >
              <HiOutlineSearch size={20} />
            </button>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-900 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 rounded-2xl text-red-700 text-sm font-bold text-center">
              {error}
            </div>
          )}

          {!loading && !error && reports.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm font-bold">
              No hay reportes Z registrados.
            </div>
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
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-800">{formatDate(r.fiscalDate)}</td>
                      <td className="p-4 font-mono font-bold text-slate-700">
                        {r.zNumber != null ? `#${r.zNumber}` : "—"}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-600">
                        {formatCurrency(r.totalSales)}
                      </td>
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
            <button
              onClick={onClose}
              className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
