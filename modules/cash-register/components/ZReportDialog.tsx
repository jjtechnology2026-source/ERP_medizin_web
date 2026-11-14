"use client";
import { useState, useCallback, useEffect, useMemo, useRef, FormEvent } from "react";
import {
  HiOutlineXCircle,
  HiOutlineDocumentReport,
  HiOutlineExclamationCircle,
  HiOutlineReceiptRefund,
  HiOutlineOfficeBuilding,
} from "react-icons/hi";
import { fiscalZReportService } from "@/modules/cash-register/api/fiscal-z-report.service";
import fiscalPrinterClient from "@/modules/cash-register/api/fiscal-printer-client";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import {
  readLastZPrint,
  recordFallbackZ,
  recordLastZPrint,
  type ZPrintedIdentity,
} from "@/modules/cash-register/lib/fiscal-fallback";
import {
  buildZRegisterPayload,
  paymentLabel,
  printZReportFallback,
  zReportErrorMessage,
} from "@/modules/cash-register/lib/fiscal-fallback-flow";
import { buildZSummary } from "@/modules/cash-register/lib/z-report";
import { printNoFiscalTicket, prepairPrinter } from "@/modules/cash-register/lib/pos80-print";
import type { CreatedZReport } from "@/modules/cash-register/types/fiscal-z-report.types";

/**
 * Las dos operaciones del cierre, nunca encadenadas:
 * - "print": solo imprime el Z (maquina fiscal, o POS80 si no responde).
 * - "register": solo carga las ventas del dia en el libro de ventas.
 */
export type ZReportMode = "print" | "register";

interface ZReportDialogProps {
  onClose: () => void;
  mode: ZReportMode;
}

type ZStep =
  | "printing"
  | "printed"
  | "print_error"
  | "registering"
  | "result"
  | "error"
  | "form";

function todayUtcDate(): string {
  return new Date().toISOString().split("T")[0];
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `Bs ${value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ZReportDialog({ onClose, mode }: ZReportDialogProps) {
  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId || profile?.id_group || "";
  const usesDigitalBilling = profile?.usesDigitalBilling ?? false;
  const sessionInvoices = useCashierWorkflowStore((s) => s.sessionInvoices);
  const sessionTransactions = useCashierWorkflowStore((s) => s.sessionTransactions);
  const { getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();
  const header = useMemo(
    () => ({
      name: String(profile?.pharmacyName || profile?.name_group || profile?.name || ""),
      rif: String(profile?.rif || ""),
      address: String(profile?.pharmacyAddress || ""),
      phone: String(profile?.pharmacyPhone || ""),
    }),
    [profile],
  );
  // Desglose por metodo de pago, YA en Bs (amountVes viene convertido de la BD).
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    const tx = (sessionTransactions || []) as Array<{
      type?: string;
      paymentMethod?: string;
      amountVes?: number;
    }>;
    for (const t of tx) {
      if (t.type !== "sale") continue;
      const label = paymentLabel(t.paymentMethod);
      map.set(label, (map.get(label) ?? 0) + (Number(t.amountVes) || 0));
    }
    return [...map.entries()].map(([label, amount]) => ({ label, amount }));
  }, [sessionTransactions]);

  // Devoluciones (notas de credito) por metodo, en Bs.
  const deviationsByMethod = useMemo(() => {
    const map = new Map<string, number>();
    const tx = (sessionTransactions || []) as Array<{
      type?: string;
      paymentMethod?: string;
      amountVes?: number;
    }>;
    for (const t of tx) {
      if (t.type !== "devolucion" && t.type !== "refund") continue;
      const label = paymentLabel(t.paymentMethod);
      map.set(label, (map.get(label) ?? 0) + (Number(t.amountVes) || 0));
    }
    return [...map.entries()].map(([label, amount]) => ({ label, amount }));
  }, [sessionTransactions]);

  // Cuadre del Z: bruto (facturas) vs cobros por metodo − devoluciones.
  const zSummary = useMemo(() => {
    const invoicedTotalVes = (sessionInvoices || []).reduce(
      (sum, inv) => sum + (Number((inv as { totalVes?: number }).totalVes) || 0),
      0,
    );
    return buildZSummary({ invoicedTotalVes, salesByMethod: paymentBreakdown, deviationsByMethod });
  }, [sessionInvoices, paymentBreakdown, deviationsByMethod]);

  const [step, setStep] = useState<ZStep>(mode === "print" ? "printing" : "registering");
  const [printedVia, setPrintedVia] = useState<ZPrintedIdentity["via"] | null>(null);
  // Identidad del ultimo Z impreso: lo que la maquina devolvio (o lo que salio
  // en la POS80). Es lo que despues reusa el registro, para que el Z del libro
  // coincida con el ticket fisico.
  const [lastPrint, setLastPrint] = useState<ZPrintedIdentity | null>(null);
  const [report, setReport] = useState<CreatedZReport | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  // El Z lee del store de la sesion: hay que cargarla aca mismo, porque este
  // dialogo tambien se abre desde Configuracion (sin pasar por la caja).
  const loadSession = useCashierWorkflowStore((s) => s.load);
  const [dataLoaded, setDataLoaded] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSession(pharmacyId || undefined);
      } finally {
        if (!cancelled) setDataLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSession, pharmacyId]);

  // --- Operacion 1: imprimir el Z (no registra nada) ---

  const rememberPrint = useCallback((identity: ZPrintedIdentity) => {
    recordLastZPrint(identity);
    setLastPrint(identity);
    setPrintedVia(identity.via);
  }, []);

  const printOnFiscalMachine = useCallback(async () => {
    setPrintedVia("fiscal");
    setPrintError(null);
    setStep("printing");
    try {
      const res = await fiscalPrinterClient.reportZ();
      if (!res?.printed) {
        setPrintError(
          res?.print_error?.trim() || "La máquina fiscal no confirmó la impresión del reporte Z.",
        );
        setStep("print_error");
        return;
      }
      // La maquina puede no devolver Nº Z ni serial: quedan en null y el
      // registro los deriva despues desde las facturas del dia.
      rememberPrint({
        pharmacyId,
        zNumber: res.z_number ?? null,
        fiscalSerial: res.fiscal_serial ?? null,
        via: "fiscal",
        printedAt: new Date().toISOString(),
      });
      setStep("printed");
    } catch (e) {
      setPrintError(
        e instanceof Error && e.message
          ? e.message
          : "No se pudo contactar la máquina fiscal.",
      );
      setStep("print_error");
    }
  }, [pharmacyId, rememberPrint]);

  // Fallback "sin maquina fiscal": el mismo Z, impreso en la POS80. Sigue sin
  // registrar: imprimir y cargar el libro son botones distintos.
  const printOnPos80 = useCallback(async () => {
    setPrintedVia("pos80");
    setPrintError(null);
    setStep("printing");
    await prepairPrinter();
    const outcome = await printZReportFallback({
      header,
      pharmacyId,
      sessionInvoices,
      paymentBreakdown: zSummary.payments,
      deviations: deviationsByMethod,
      netTotal: zSummary.netTotal,
      reconciliation: zSummary.reconciliation,
      rate,
      print: printNoFiscalTicket,
    });
    if (!outcome.printed) {
      setPrintError(outcome.error || "No se pudo imprimir el reporte Z en la POS80.");
      setStep("print_error");
      return;
    }
    rememberPrint({
      pharmacyId,
      zNumber: outcome.fallback.z_number,
      fiscalSerial: outcome.fallback.fiscal_serial,
      via: "pos80",
      printedAt: new Date().toISOString(),
    });
    setStep("printed");
  }, [
    header,
    pharmacyId,
    sessionInvoices,
    zSummary,
    deviationsByMethod,
    rate,
    rememberPrint,
  ]);

  // --- Operacion 2: registrar el Z en el libro (no imprime nada) ---

  const register = useCallback(async () => {
    if (!pharmacyId) {
      setErrorMessage("No se pudo resolver la farmacia.");
      setErrorDetails(null);
      setStep("error");
      return;
    }
    // Identidad capturada por la ultima impresion de esta farmacia. Sin print
    // previo el payload va vacio y el backend deriva Nº Z, serial y rango.
    const captured = readLastZPrint(pharmacyId);
    setLastPrint(captured);
    setErrorMessage("");
    setErrorDetails(null);
    setStep("registering");

    const result = await fiscalZReportService.createZReport(
      pharmacyId,
      buildZRegisterPayload(captured),
    );

    if (!result.success || !result.report) {
      setErrorMessage(zReportErrorMessage(result));
      setErrorDetails(result.details);
      setStep("error");
      return;
    }

    // El historial marca con "POS80" el Z cuyo papel salio por la POS80.
    if (captured?.via === "pos80") {
      recordFallbackZ({
        pharmacyId,
        fiscalDate: result.report.fiscalDate,
        zNumber: result.report.zNumber,
      });
    }

    setReport(result.report);
    setStep("result");
  }, [pharmacyId]);

  // Arranque unico: imprimir o registrar, nunca las dos cosas.
  useEffect(() => {
    if (!dataLoaded || startedRef.current) return;
    startedRef.current = true;
    const start = async () => {
      // Ceder el turno: el arranque no puede ser un setState sincrono del efecto.
      await Promise.resolve();
      if (mode === "print") {
        // Con facturacion digital no hay maquina fiscal: el papel sale por la POS80.
        await (usesDigitalBilling ? printOnPos80() : printOnFiscalMachine());
        return;
      }
      await register();
    };
    void start();
  }, [dataLoaded, mode, usesDigitalBilling, printOnPos80, printOnFiscalMachine, register]);

  const [zNumber, setZNumber] = useState("");
  const [fiscalSerial, setFiscalSerial] = useState("");
  const [fiscalDate, setFiscalDate] = useState(todayUtcDate());
  const [invoiceCount, setInvoiceCount] = useState("");
  const [docFrom, setDocFrom] = useState("");
  const [docTo, setDocTo] = useState("");

  const validate = useCallback((): string | null => {
    if (!pharmacyId) return "No se pudo resolver la farmacia.";
    const z = Number(zNumber);
    if (!Number.isInteger(z) || z <= 0) return "El Nº Z debe ser un entero mayor a 0.";
    if (!fiscalSerial.trim()) return "El serial fiscal es obligatorio.";
    const count = Number(invoiceCount);
    if (!Number.isInteger(count) || count < 0) return "La cantidad de facturas debe ser un entero ≥ 0.";
    if (!docFrom.trim()) return "El documento inicial es obligatorio.";
    if (!docTo.trim()) return "El documento final es obligatorio.";
    if (fiscalDate && !/^\d{4}-\d{2}-\d{2}$/.test(fiscalDate)) {
      return "La fecha fiscal debe tener formato YYYY-MM-DD.";
    }
    return null;
  }, [pharmacyId, zNumber, fiscalSerial, invoiceCount, docFrom, docTo, fiscalDate]);

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      setFormError(null);

      const validationError = validate();
      if (validationError) {
        setFormError(validationError);
        return;
      }

      setStep("registering");

      const payload = {
        z_number: Number(zNumber),
        fiscal_serial: fiscalSerial.trim(),
        invoices: {
          count: Number(invoiceCount),
          doc_from: docFrom.trim(),
          doc_to: docTo.trim(),
        },
        ...(fiscalDate.trim() ? { fiscal_date: fiscalDate.trim() } : {}),
      };

      const result = await fiscalZReportService.createZReport(pharmacyId, payload);

      if (!result.success || !result.report) {
        setErrorMessage(zReportErrorMessage(result));
        setErrorDetails(result.details);
        setStep("error");
        return;
      }

      setReport(result.report);
      setStep("result");
    },
    [validate, zNumber, fiscalSerial, invoiceCount, docFrom, docTo, fiscalDate, pharmacyId]
  );

  const inputClass =
    "w-full p-4 bg-[#E9E9E9] border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm font-bold text-slate-700";
  const labelClass =
    "text-[11px] font-black text-slate-800 uppercase tracking-widest ml-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
              <HiOutlineDocumentReport size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                {mode === "print" ? "Imprimir reporte Z" : "Registrar en libro de ventas"}
              </h2>
              <p className="text-xs font-bold text-slate-400">
                {mode === "print"
                  ? "Solo imprime el Z. No registra nada en el sistema."
                  : "Solo registra el Z. No imprime nada."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <HiOutlineXCircle size={22} className="text-slate-400" />
          </button>
        </div>

        {step === "printing" && (
          <div className="p-10 flex flex-col items-center gap-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-900 border-t-transparent" />
            <p className="text-sm font-bold text-slate-600">
              {printedVia === "pos80"
                ? "Imprimiendo reporte Z en la POS80..."
                : "Imprimiendo reporte Z en la máquina fiscal..."}
            </p>
            <p className="text-[11px] font-bold text-slate-400 max-w-sm">
              No se registra nada: el libro de ventas se carga con el botón «Registrar en libro de ventas».
            </p>
          </div>
        )}

        {step === "print_error" && (
          <div className="p-8 flex flex-col items-center gap-6 text-center">
            <div className="p-5 bg-red-50 rounded-full text-red-500">
              <HiOutlineXCircle size={48} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800 mb-2">Error de impresión</p>
              <p className="text-sm text-slate-500 max-w-md">{printError}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void printOnPos80()}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all"
              >
                Imprimir en la POS80
              </button>
              {!usesDigitalBilling && (
                <button
                  type="button"
                  onClick={() => void printOnFiscalMachine()}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
                >
                  Reintentar en la máquina fiscal
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cerrar
              </button>
            </div>
            <p className="text-[11px] font-bold text-slate-400 max-w-md">
              Imprimir en la POS80 tampoco registra el Z en el libro de ventas.
            </p>
          </div>
        )}

        {step === "printed" && (
          <div className="p-6 space-y-5">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
              <p className="text-sm font-black text-emerald-700">Reporte Z impreso</p>
              <p className="text-xs font-bold text-emerald-600/80 mt-1">
                {lastPrint?.zNumber ? `Z #${lastPrint.zNumber}` : "Z # no informado"} ·{" "}
                {lastPrint?.fiscalSerial || "serial no informado"}
              </p>
              <p className="text-[11px] font-bold text-emerald-600/70 mt-1">
                {printedVia === "pos80"
                  ? "Salió por la POS80 porque la máquina fiscal no respondió."
                  : "Salió por la máquina fiscal."}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-xs font-black text-amber-600 uppercase tracking-wider">
                Todavía no está en el libro de ventas
              </p>
              <p className="text-[11px] font-medium text-amber-800/80 leading-relaxed mt-1">
                El reporte Z se imprimió pero NO quedó registrado en el sistema. La venta del día
                no aparecerá en el libro hasta que uses «Registrar en libro de ventas» en
                Configuración fiscal.
              </p>
              {!lastPrint?.zNumber && !lastPrint?.fiscalSerial && (
                <p className="text-[11px] font-medium text-amber-800/80 leading-relaxed mt-2">
                  La impresión no devolvió el Nº Z ni el serial: el registro los derivará de las
                  facturas del día.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="flex gap-3 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100">
              <HiOutlineExclamationCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <p className="text-amber-800/80 text-[11px] font-medium leading-relaxed">
                Primero cierra / imprime el Z en la máquina fiscal. Luego registra aquí el Nº Z,
                serial y rango de documentos. El backend completa ventas, notas y retenciones del día.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  Nº Z <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={zNumber}
                  onChange={(e) => setZNumber(e.target.value)}
                  placeholder="128"
                  className={inputClass}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  Serial fiscal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fiscalSerial}
                  onChange={(e) => setFiscalSerial(e.target.value)}
                  placeholder="Z1F1234567"
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass}>Fecha fiscal</label>
              <input
                type="date"
                value={fiscalDate}
                onChange={(e) => setFiscalDate(e.target.value)}
                className={inputClass}
              />
              <p className="text-[10px] font-bold text-slate-400 ml-1">
                Opcional. Si la omites, el backend usa la fecha UTC de hoy.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-4">
              <p className={labelClass}>Rango de facturas (Z físico)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Cantidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={invoiceCount}
                    onChange={(e) => setInvoiceCount(e.target.value)}
                    placeholder="40"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Doc. desde <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={docFrom}
                    onChange={(e) => setDocFrom(e.target.value)}
                    placeholder="00000382"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Doc. hasta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={docTo}
                    onChange={(e) => setDocTo(e.target.value)}
                    placeholder="00000421"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 text-xs font-mono border border-slate-100">
              <span className="text-slate-400">Farmacia:</span>{" "}
              <span className="font-bold text-slate-700">{pharmacyId || "—"}</span>
            </div>

            {formError && (
              <p className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3">
                {formError}
              </p>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-lg"
              >
                Registrar reporte Z
              </button>
            </div>
          </form>
        )}

        {step === "registering" && (
          <div className="p-10 flex flex-col items-center gap-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-900 border-t-transparent" />
            <p className="text-sm font-bold text-slate-600">Registrando reporte Z en el libro de ventas...</p>
            <p className="text-[11px] font-bold text-slate-400 max-w-sm">
              {lastPrint
                ? `Con los datos de la última impresión: Z #${lastPrint.zNumber ?? "—"} · ${lastPrint.fiscalSerial ?? "—"}`
                : "Sin impresión previa en este navegador: el backend deriva el Nº Z y el serial de las facturas del día."}
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="p-8 flex flex-col items-center gap-6 text-center">
            <div className="p-5 bg-red-50 rounded-full text-red-500">
              <HiOutlineXCircle size={48} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800 mb-2">Error</p>
              <p className="text-sm text-slate-500 max-w-md">{errorMessage}</p>
            </div>
            {errorDetails && (
              <div className="w-full max-w-md bg-slate-50 rounded-2xl p-4 text-left border border-slate-200">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                  Respuesta backend
                </p>
                <p className="text-xs font-mono font-bold text-red-600 break-all">{errorDetails}</p>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void register()}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all"
              >
                Reintentar
              </button>
              {mode === "register" && (
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
                >
                  Registrar con datos del ticket
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {step === "result" && report && (
          <div className="p-6 space-y-5">
            {!zSummary.ok && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-xs font-black text-red-600 uppercase tracking-wider">
                  Diferencia en el cuadre
                </p>
                <p className="text-sm font-bold text-red-700 mt-1">
                  Cobrado{" "}
                  {formatMoney(zSummary.payments.reduce((sum, p) => sum + p.amount, 0))} vs facturado{" "}
                  {formatMoney(zSummary.grossTotal)} · Diferencia {formatMoney(zSummary.salesDiff)}
                </p>
              </div>
            )}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
              <p className="text-sm font-black text-emerald-700">Reporte Z registrado</p>
              <p className="text-xs font-bold text-emerald-600/80 mt-1">
                Z #{report.zNumber} · {report.fiscalDate || "—"}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <HiOutlineOfficeBuilding size={18} className="text-slate-500" />
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  Datos fiscales
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Serial
                  </span>
                  <span className="font-bold text-slate-800">{report.fiscalSerial || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    ID
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    {report.id || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <HiOutlineReceiptRefund size={18} className="text-slate-500" />
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  Totales del día (backend)
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                    Ventas totales
                  </span>
                  <span className="text-base font-black text-emerald-700">
                    {formatMoney(report.totalSales)}
                  </span>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                    Base imponible
                  </span>
                  <span className="text-base font-black text-blue-700">
                    {formatMoney(report.taxedSales)}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Exento
                  </span>
                  <span className="text-base font-black text-slate-700">
                    {formatMoney(report.exemptSales)}
                  </span>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                    Contribuyentes
                  </span>
                  <span className="text-base font-black text-amber-700">
                    {report.taxpayers ?? "—"} / {report.nonTaxpayers ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            {report.invoices && (
              <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  Facturas
                </p>
                <p className="font-bold text-slate-800">
                  {report.invoices.count} docs · {report.invoices.docFrom} → {report.invoices.docTo}
                </p>
              </div>
            )}

            {(report.creditNotes || report.debitNotes) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {report.creditNotes && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      Notas de crédito
                    </p>
                    <p className="font-bold text-slate-800">
                      {report.creditNotes.count}
                      {report.creditNotes.total != null
                        ? ` · ${formatMoney(report.creditNotes.total)}`
                        : ""}
                    </p>
                  </div>
                )}
                {report.debitNotes && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      Notas de débito
                    </p>
                    <p className="font-bold text-slate-800">
                      {report.debitNotes.count}
                      {report.debitNotes.total != null
                        ? ` · ${formatMoney(report.debitNotes.total)}`
                        : ""}
                    </p>
                  </div>
                )}
              </div>
            )}

            {report.taxWithholdingsCount != null && (
              <p className="text-xs font-bold text-slate-500">
                Retenciones IVA:{" "}
                <span className="text-slate-800">{report.taxWithholdingsCount}</span>
              </p>
            )}

            <p className="text-[11px] font-bold text-slate-400 text-center">
              No se imprimió nada en esta operación.
            </p>

            <div className="flex justify-end pt-1">
              <button
                type="button"
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
