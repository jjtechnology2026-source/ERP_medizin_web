"use client";
import React, { useEffect, useState } from "react";
import fiscalPrinterClient, { setFiscalBrand } from "@/modules/cash-register/api/fiscal-printer-client";
import { useChatToast } from "@/modules/core/providers/ChatToastProvider";
import FiscalDiagnosticDialog from "@/modules/settings/components/FiscalDiagnosticDialog";
import ZReportDialog from "@/modules/cash-register/components/ZReportDialog";
import ZReportHistoryDialog from "@/modules/cash-register/components/ZReportHistoryDialog";

// Implementaciones fiscales reales cableadas al servicio (service_fiscal).
// El value es la marca que usa el cliente para enrutar a /bematech/* o a las
// rutas raiz (hka80). "PNP" se descarta: no tiene implementacion en el servicio.
const FISCAL_SUPPORT_DATA = [
  {
    id: "hka80",
    name: "The Factory HKA",
    status: "Soportado",
    description: "FISCAT HKA80 (protocolo HKA v8.5.0) via las rutas raiz del servicio fiscal.",
  },
  {
    id: "bematech",
    name: "Potencia de POS Venezuela",
    status: "Soportado",
    description: "Bematech MP-4200 FI / SX4200 (FW 01.00.22) via /bematech/*.",
  },
];

const FISCAL_PORT_STORAGE_KEY = "fiscal-serial-port";

// Puerto persistido en localStorage: sobrevive al refresh aunque el
// servicio fiscal no responda en ese momento.
function getStoredPort(): string {
  if (typeof window === "undefined") return "99";
  return window.localStorage.getItem(FISCAL_PORT_STORAGE_KEY) ?? "99";
}

function persistPort(serialPort: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FISCAL_PORT_STORAGE_KEY, serialPort);
}

export default function FiscalConfigCard() {
  const chatToast = useChatToast();
  const [implementation, setImplementation] = useState<string>(() => {
    if (typeof window === "undefined") return "hka80";
    return window.localStorage.getItem("fiscal-implementation") ?? "hka80";
  });
  const [port, setPort] = useState<string>(getStoredPort);
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [portStatus, setPortStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reportXStatus, setReportXStatus] = useState<"idle" | "printing" | "done" | "error">("idle");
  const [serviceInstalled, setServiceInstalled] = useState<boolean | null>(null);
  const [showZReport, setShowZReport] = useState(false);
  const [showZHistory, setShowZHistory] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [installStatus, setInstallStatus] = useState<"idle" | "installing" | "done" | "error">("idle");
  const [showManualInstall, setShowManualInstall] = useState(false);

  useEffect(() => {
    const checkService = () => {
      fiscalPrinterClient
        .getHealth()
        .then(() => setServiceInstalled(true))
        .catch(() => setServiceInstalled(false));
    };

    checkService();
    const timer = setInterval(checkService, 15000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fiscalPrinterClient
      .getHealth()
      .then((health) => {
        if (health?.serial_port) {
          setPort(String(health.serial_port));
          persistPort(String(health.serial_port));
        }
      })
      .catch(() => {
        // Servicio fiscal no disponible; se mantiene el valor local.
      });

    fiscalPrinterClient
      .listSerialPorts()
      .then((res) => {
        setAvailablePorts((res.ports ?? []).map((p) => p.device));
      })
      .catch(() => {
        // Sin listado de puertos; el input queda libre.
      });
  }, []);

  const handleAction = (action: string) => {
    console.log(`Ejecutando acción: ${action}`);
  };

  // Cambia la marca activa del cliente fiscal (enruta a hka80 o /bematech/*).
  const handleImplementationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const brand = e.target.value as "hka80" | "bematech";
    setImplementation(brand);
    setFiscalBrand(brand);
  };

  // Instala o actualiza el servicio fiscal en la PC de la caja con un solo clic.
  // Si el servicio ya responde (/health), actua como "Actualizar servicio":
  // dispara el protocolo que fuerza la verificacion de actualizaciones
  // (update.ps1 -Restart) y arranca el servicio si hace falta.
  // Si el servicio no responde, actua como "Instalar servicio":
  // 1. Dispara el protocolo local medizin-fiscal://install (registrado por el
  //    instalador; ejecuta el launcher silencioso).
  // 2. Hace polling de /health y muestra el resultado en la card.
  // Plan B (primera vez en una maquina nueva): si el protocolo no esta
  // registrado, se ofrece descargar el instalador .cmd (una sola vez).
  const handleInstallService = () => {
    setInstallStatus("installing");
    setShowManualInstall(false);

    if (serviceInstalled) {
      chatToast.show("Buscando actualizaciones del servicio fiscal...");
      window.location.href = "medizin-fiscal://install";

      const startedAt = Date.now();
      const interval = setInterval(async () => {
        try {
          const health = await fiscalPrinterClient.getHealth();
          if (health?.status === "ok") {
            clearInterval(interval);
            setInstallStatus("done");
            chatToast.show("Verificación de actualizaciones completada.");
            setTimeout(() => setInstallStatus("idle"), 4000);
            return;
          }
        } catch {
          // el servicio se esta reiniciando por la actualizacion
        }
        if (Date.now() - startedAt > 30000) {
          clearInterval(interval);
          setInstallStatus("error");
          chatToast.show("El servicio fiscal no respondió tras la verificación.");
          setTimeout(() => setInstallStatus("idle"), 4000);
        }
      }, 3000);
      return;
    }

    window.location.href = "medizin-fiscal://install";

    const startedAt = Date.now();
    const interval = setInterval(async () => {
      try {
        const health = await fiscalPrinterClient.getHealth();
        if (health?.status === "ok") {
          clearInterval(interval);
          setInstallStatus("done");
          chatToast.show("Servicio fiscal instalado correctamente. ¡Listo para facturar!");
          setTimeout(() => setInstallStatus("idle"), 4000);
          return;
        }
      } catch {
        // aun instalando
      }
      if (Date.now() - startedAt > 15000) {
        clearInterval(interval);
        setInstallStatus("error");
        setShowManualInstall(true);
        chatToast.show("La instalación automática no se pudo iniciar. Use el instalador manual (una sola vez).");
      }
    }, 2000);
  };

  const handleDownloadInstaller = () => {
    const origin = window.location.origin;
    const cmd = `@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -Command "$u='${origin}/install-fiscal-service.ps1'; $p=Join-Path $env:TEMP 'install_fiscal_service.ps1'; Invoke-WebRequest $u -OutFile $p; & $p"\r\npause\r\n`;
    const blob = new Blob([cmd], { type: "application/x-msdownload" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "instalar-servicio-fiscal.cmd";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    chatToast.show("Descargado. Haga doble clic en 'instalar-servicio-fiscal.cmd' (una sola vez) y luego siempre use el botón Instalar servicio.");
  };

  const handleSavePort = async () => {
    setPortStatus("saving");
    try {
      const res = await fiscalPrinterClient.setSerialPort(port);
      if (res?.serial_port) {
        setPort(res.serial_port);
        persistPort(res.serial_port);
      }
      setPortStatus("saved");
      chatToast.show(`Configuración fiscal guardada correctamente (puerto ${res.serial_port ?? port}).`);
      setTimeout(() => setPortStatus("idle"), 4000);
    } catch (e) {
      setPortStatus("error");
      chatToast.show(`Error al guardar la configuración fiscal: ${e instanceof Error ? e.message : "servicio no disponible"}`);
      setTimeout(() => setPortStatus("idle"), 4000);
    }
  };

  const handleReportX = async () => {
    setReportXStatus("printing");
    try {
      await fiscalPrinterClient.reportX();
      setReportXStatus("done");
      chatToast.show("Reporte X generado correctamente.");
      setTimeout(() => setReportXStatus("idle"), 4000);
    } catch (e) {
      setReportXStatus("error");
      chatToast.show(`Error al generar el reporte X: ${e instanceof Error ? e.message : "servicio no disponible"}`);
      setTimeout(() => setReportXStatus("idle"), 4000);
    }
  };

  return (
    <>
    <div className="flex flex-col gap-8 w-full">
      {/* --- SECCIÓN SUPERIOR: CONFIGURACIÓN Y ESTADO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-8 items-start">
        
        {/* Card 1: Configuración Fiscal */}
        <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-10">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Configuración fiscal</h2>
            <p className="text-sm font-bold text-slate-400 max-w-2xl">Organiza la implementación fiscal y las acciones operativas en un solo bloque.</p>
          </div>

          <div className="flex flex-col gap-8 max-w-3xl">
            {/* Select: Implementación Fiscal */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-black text-slate-800 uppercase tracking-widest ml-1">
                Implementación Fiscal: <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={implementation}
                  onChange={handleImplementationChange}
                  className="w-full p-5 bg-[#E9E9E9] border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base font-bold text-slate-600 appearance-none pr-12"
                >
                  <option value="hka80">The Factory HKA</option>
                  <option value="bematech">Potencia de POS Venezuela</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Input: Puerto */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-black text-slate-800 uppercase tracking-widest ml-1">
                Puerto de la máquina fiscal: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="99"
                list="fiscal-serial-ports"
                className="w-full p-5 bg-[#E9E9E9] border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base font-bold text-slate-600"
              />
              <datalist id="fiscal-serial-ports">
                {availablePorts.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              {availablePorts.length > 0 && (
                <p className="text-[11px] font-bold text-slate-400 ml-1">
                  Puertos detectados: {availablePorts.join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-5 mt-2">
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleInstallService}
                disabled={installStatus === "installing"}
                className="px-10 py-5 bg-[#16a34a] text-white font-black text-[15px] rounded-xl shadow-lg shadow-green-100 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
              >
                {installStatus === "installing"
                  ? serviceInstalled
                    ? "Buscando actualizaciones..."
                    : "Instalando servicio..."
                  : installStatus === "done"
                    ? "Listo"
                    : installStatus === "error"
                      ? "Reintentar"
                      : serviceInstalled
                        ? "Actualizar servicio"
                        : "Instalar servicio"}
              </button>
              {showManualInstall && (
                <button
                  onClick={handleDownloadInstaller}
                  className="px-10 py-5 bg-[#f59e0b] text-white font-black text-[15px] rounded-xl hover:brightness-110 transition-all active:scale-95"
                >
                  Descargar instalador (una sola vez)
                </button>
              )}
              <button
                onClick={handleSavePort}
                disabled={portStatus === "saving"}
                className="px-10 py-5 bg-[#005eff] text-white font-black text-[15px] rounded-xl shadow-lg shadow-blue-100 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
              >
                {portStatus === "saving"
                  ? "Guardando..."
                  : portStatus === "saved"
                    ? "Puerto guardado"
                    : portStatus === "error"
                      ? "Error al guardar"
                      : "Guardar Configuración Fiscal"}
              </button>
              <button
                onClick={() => setShowDiagnostic(true)}
                className="px-10 py-5 bg-[#E0E3FF] text-[#4F46E5] font-black text-[15px] rounded-xl hover:brightness-105 transition-all active:scale-95"
              >
                Abrir Diagnóstico Fiscal
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleReportX}
                disabled={reportXStatus === "printing"}
                className="px-10 py-5 bg-[#0f766e] text-white font-black text-[15px] rounded-xl hover:brightness-125 transition-all active:scale-95 disabled:opacity-50"
              >
                {reportXStatus === "printing"
                  ? "Imprimiendo reporte X..."
                  : reportXStatus === "done"
                    ? "Reporte X generado"
                    : reportXStatus === "error"
                      ? "Error en reporte X"
                      : "Generar reporte X"}
              </button>
              <button
                onClick={() => setShowZReport(true)}
                className="px-10 py-5 bg-[#1f2937] text-white font-black text-[15px] rounded-xl hover:brightness-125 transition-all active:scale-95"
              >
                Generar reporte Z
              </button>
              <button
                onClick={() => setShowZHistory(true)}
                className="px-10 py-5 bg-[#374151] text-white font-black text-[15px] rounded-xl hover:brightness-125 transition-all active:scale-95"
              >
                Historial Z
              </button>
              <button
                onClick={() => handleAction("Ver Auditoria Fiscal")}
                className="px-10 py-5 bg-[#7A3314] text-white font-black text-[15px] rounded-xl hover:brightness-110 transition-all active:scale-95"
              >
                Ver Auditoria Fiscal
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Estado Actual */}
        <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-10">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Estado actual</h2>
            <p className="text-sm font-bold text-slate-400">Resumen rápido de la implementación seleccionada y de las acciones disponibles.</p>
          </div>

          <div className="space-y-6">
            <div className="bg-[#F8FAFC] p-8 rounded-[2.5rem] border border-slate-50">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Implementación activa</p>
              <p className="text-base font-black text-slate-800">{implementation}</p>
            </div>

            <div className="bg-[#F8FAFC] p-8 rounded-[2.5rem] border border-slate-50">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Soporte adicional</p>
              <p className="text-base font-black text-emerald-600">Disponible</p>
            </div>
            
            <p className="text-xs font-bold text-slate-400 px-4 leading-relaxed">
              Soporte operativo para maquinas fiscales HKA80 y Bematech (Potencia de POS Venezuela).
            </p>
          </div>
        </div>
      </div>

      {/* --- SECCIÓN INFERIOR: SOPORTE POR IMPLEMENTACIÓN --- */}
      <div className="bg-white p-10 md:p-12 rounded-[3rem] shadow-sm border border-slate-100 space-y-10 mt-2">
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">Soporte por implementación</h2>
          <p className="text-base font-bold text-slate-400">Comparativa rápida para saber qué proveedor ofrece funciones adicionales.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FISCAL_SUPPORT_DATA.map((item) => (
            <div key={item.id} className="bg-[#F8FAFC] p-10 rounded-[2.5rem] border border-slate-100 flex flex-col gap-5">
              <div>
                <p className="text-lg font-black text-slate-800">{item.name}</p>
                <p className="text-[12px] font-black text-emerald-600 uppercase tracking-widest mt-1.5">{item.status}</p>
              </div>
              <p className="text-sm font-bold text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
      {showZReport && <ZReportDialog onClose={() => setShowZReport(false)} />}
      {showZHistory && <ZReportHistoryDialog onClose={() => setShowZHistory(false)} />}
      {showDiagnostic && <FiscalDiagnosticDialog onClose={() => setShowDiagnostic(false)} />}
    </>
  );
}