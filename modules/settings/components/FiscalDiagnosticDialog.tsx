"use client";
import React, { useCallback, useEffect, useState } from "react";
import { HiOutlineXCircle, HiOutlineRefresh, HiOutlineTerminal } from "react-icons/hi";
import fiscalPrinterClient from "@/modules/cash-register/api/fiscal-printer-client";

interface FiscalDiagnosticDialogProps {
  onClose: () => void;
}

interface HealthInfo {
  status?: string;
  serial_port?: string;
  baudrate?: number;
  timeout_seconds?: number;
  report_z_configured?: boolean;
  invoice_commands_enabled?: boolean;
}

interface PrinterStatusInfo {
  command?: string;
  frame_hex?: string;
  response?: Record<string, string | number>;
  data?: string | null;
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function FiscalDiagnosticDialog({ onClose }: FiscalDiagnosticDialogProps) {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatusInfo | null>(null);
  const [ports, setPorts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDiagnostics = useCallback(async () => {
    const [healthRes, statusRes, portsRes] = await Promise.all([
      fiscalPrinterClient.getHealth(),
      fiscalPrinterClient.getPrinterStatus(),
      fiscalPrinterClient.listSerialPorts(),
    ]);
    return { healthRes, statusRes, portsRes };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { healthRes, statusRes, portsRes } = await fetchDiagnostics();
        setHealth(healthRes ?? null);
        setPrinterStatus(statusRes ?? null);
        setPorts((portsRes?.ports ?? []).map((p) => p.device));
        setError(null);
      } catch (e) {
        setError(errorMessage(e, "No se pudo conectar con el servicio fiscal (127.0.0.1:8000)."));
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchDiagnostics]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const { healthRes, statusRes, portsRes } = await fetchDiagnostics();
      setHealth(healthRes ?? null);
      setPrinterStatus(statusRes ?? null);
      setPorts((portsRes?.ports ?? []).map((p) => p.device));
    } catch (e) {
      setError(errorMessage(e, "No se pudo conectar con el servicio fiscal (127.0.0.1:8000)."));
    } finally {
      setLoading(false);
    }
  };

  const row = (label: string, value: unknown) => (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <span className="text-sm font-black text-slate-800 text-right break-all">
        {value === undefined || value === null || value === "" ? "—" : String(value)}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
              <HiOutlineTerminal size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Diagnóstico Fiscal</h2>
              <p className="text-xs font-bold text-slate-400">Consulta al servicio fiscal en localhost</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40"
              title="Refrescar"
            >
              <HiOutlineRefresh size={22} className={`text-slate-400 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <HiOutlineXCircle size={22} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {loading && (
            <div className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-900 border-t-transparent" />
              <p className="text-sm font-bold text-slate-600">Consultando servicio fiscal...</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-5 bg-red-50 rounded-2xl border border-red-100">
              <p className="text-sm font-bold text-red-700">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Servicio</p>
                <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100">
                  {row("Estado", health?.status)}
                  {row("Puerto serial", health?.serial_port)}
                  {row("Baudrate", health?.baudrate)}
                  {row("Timeout (s)", health?.timeout_seconds)}
                  {row("Reporte Z configurado", health?.report_z_configured ? "Sí" : "No")}
                  {row("Comandos de factura", health?.invoice_commands_enabled ? "Activados" : "Desactivados")}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Impresora</p>
                <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100">
                  {row("Comando", printerStatus?.command)}
                  {row("Trama (hex)", printerStatus?.frame_hex)}
                  {row("Respuesta", printerStatus?.data ?? JSON.stringify(printerStatus?.response ?? {}))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Puertos detectados</p>
                <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100">
                  {ports.length > 0 ? (
                    <p className="text-sm font-black text-slate-800 break-all">{ports.join(", ")}</p>
                  ) : (
                    <p className="text-sm font-bold text-slate-400">No se detectaron puertos seriales.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
