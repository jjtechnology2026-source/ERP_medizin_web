"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import {
  buildCierreBalances,
  buildFiscalResumen,
  buildMethodBreakdown,
  computeDifference,
} from "@/modules/cash-register/lib/cierre-caja";
import {
  HiOutlineDownload,
  HiOutlineLockClosed,
  HiOutlineCalculator,
  HiOutlineInformationCircle,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineChevronRight,
} from "react-icons/hi";
import ActionBar from "@/components/ui/action-bar";
import MobileMethodBreakdown from "./components/MobileMethodBreakdown";
import PhysicalCountSheet from "./components/PhysicalCountSheet";
import {
  COUNTED_FIELD_BY_METHOD,
  METHOD_BG,
  METHOD_COLORS,
  METHOD_ICONS,
  METHOD_LABELS,
  PAYMENT_METHOD_KEYS,
  type PaymentMethodKey,
} from "./components/payment-method";
import {
  COUNT_FIELDS,
  countFilledFields,
  emptyPhysicalCount,
  parseCountInput,
  type PhysicalCount,
} from "./lib/physical-count";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resumen de la diferencia que acompaña a la accion primaria de la barra: en un
 * telefono el total del descuadre tiene que estar siempre a la vista, sin bajar
 * hasta el balance (T6). Se dice en palabras cuando cuadra porque el color solo
 * no alcanza (WCAG 1.4.1).
 */
function describeDifference(differenceVes: number, differenceUsd: number): string {
  if (differenceVes === 0 && differenceUsd === 0) return "Caja cuadrada";
  const parts: string[] = [];
  if (differenceVes !== 0) {
    parts.push(`Bs ${differenceVes > 0 ? "+" : ""}${differenceVes.toFixed(2)}`);
  }
  if (differenceUsd !== 0) {
    parts.push(`USD ${differenceUsd > 0 ? "+" : ""}${differenceUsd.toFixed(2)}`);
  }
  return `Dif. ${parts.join(" · ")}`;
}

export default function CashClosurePage() {
  const router = useRouter();
  const {
    activeSession,
    sessionTransactions,
    sessionInvoices,
    currentRate,
    requestCloseSession,
    isSubmitting,
    errorMessage,
    infoMessage,
    clearMessages,
    load,
  } = useCashierWorkflowStore();

  const [physicalCount, setPhysicalCount] = useState<PhysicalCount>(emptyPhysicalCount);
  // El conteo fisico es un sheet en el telefono (T6): siete inputs en la
  // superficie dejaban la pantalla con nueve controles visibles (S6).
  const [showCountSheet, setShowCountSheet] = useState(false);

  // La clasificacion por metodo vive en el componente; la matematica del
  // cierre (neto, saldo teorico y diferencia) vive en el modulo puro.
  const transactionsWithMethod = useMemo(
    () => sessionTransactions.map((tx) => ({ ...tx, method: mapTransactionToMethod(tx) })),
    [sessionTransactions]
  );

  const balances = useMemo(
    () =>
      buildCierreBalances({
        transactions: transactionsWithMethod,
        openingAmountVes: activeSession?.openingAmountVes ?? 0,
        openingAmountUsd: activeSession?.openingAmountUsd ?? 0,
        // El backend ya envia el saldo teorico neto (resta las notas de credito)
        // y es lo que el cierre persiste como base de la diferencia: por
        // contrato del backend, no se recalcula aca.
        authoritativeVes: activeSession?.theoreticalAmountVes,
        authoritativeUsd: activeSession?.theoreticalAmountUsd,
      }),
    [transactionsWithMethod, activeSession]
  );

  const totalsByMethod = balances.methodTotals;
  const theoreticalBalanceVes = balances.theoreticalBalanceVes;
  const theoreticalBalanceUsd = balances.theoreticalBalanceUsd;

  const physicalTotalVes = physicalCount.efectivo_ves + physicalCount.tarjeta_ves + physicalCount.pagomovil_ves + physicalCount.biopago_ves + physicalCount.cashea_ves + physicalCount.otros_ves;
  const physicalTotalUsd = physicalCount.efectivo_usd + physicalCount.divisa_electronica_usd;

  const differenceVes = computeDifference(physicalTotalVes, theoreticalBalanceVes);
  const differenceUsd = computeDifference(physicalTotalUsd, theoreticalBalanceUsd);

  const countedByMethod = useMemo(() => {
    const counts = {} as Record<PaymentMethodKey, number>;
    for (const method of PAYMENT_METHOD_KEYS) {
      counts[method] = physicalCount[COUNTED_FIELD_BY_METHOD[method]];
    }
    return counts;
  }, [physicalCount]);

  // El esperado por metodo sale de los movimientos locales; el saldo teorico
  // autoritativo del backend es un TOTAL fiscal, no un dato por metodo. Si la
  // suma local no coincide con ese total, `methodBreakdown.divergence` lo
  // muestra en su propia fila: no es un bug de render, es un descuadre real
  // entre los movimientos de caja y los documentos fiscales.
  const methodBreakdown = useMemo(
    () =>
      buildMethodBreakdown({
        expectedByMethod: totalsByMethod,
        countedByMethod,
        authoritativeTotal: theoreticalBalanceVes,
      }),
    [totalsByMethod, countedByMethod, theoreticalBalanceVes]
  );

  const formatPrice = (amount: number) => `Bs ${amount.toFixed(2)}`;
  const formatUsd = (amount: number) => `$ ${amount.toFixed(2)}`;

  const handlePhysicalCountChange = (field: keyof PhysicalCount, value: string) => {
    const num = parseCountInput(value);
    setPhysicalCount((prev) => ({ ...prev, [field]: num }));
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;

    await requestCloseSession(
      {
        efectivo_ves: physicalCount.efectivo_ves,
        tarjeta_ves: physicalCount.tarjeta_ves,
        otros_ves: 0,
        pago_movil_ves: physicalCount.pagomovil_ves,
        biopago_ves: physicalCount.biopago_ves,
        cashea_ves: physicalCount.cashea_ves,
        efectivo_usd: physicalCount.efectivo_usd,
        tarjeta_usd: 0,
        otros_usd: 0,
        divisa_electronica_usd: physicalCount.divisa_electronica_usd,
      },
      {
        observations: "Cierre de turno",
        openNewTurn: false,
      }
    );
  };

  const salesData = PAYMENT_METHOD_KEYS.map((method) => ({
    label: METHOD_LABELS[method],
    value: method === "dolares" || method === "divisa_electronica" ? `${(totalsByMethod[method] / (currentRate || 1)).toFixed(2)} USD` : totalsByMethod[method].toFixed(2),
    icon: METHOD_ICONS[method],
    color: METHOD_COLORS[method],
    bg: METHOD_BG[method],
  }));

  const fiscalResumen = useMemo(() => buildFiscalResumen(sessionInvoices), [sessionInvoices]);

  const countFilled = countFilledFields(physicalCount);
  const differenceSummary = describeDifference(differenceVes, differenceUsd);

  useEffect(() => {
    if (!activeSession) {
      router.push("/caja-ventas");
    }
  }, [activeSession, router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-10 font-sans text-slate-900">
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6 lg:mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-800">
            Cierre de <span className="text-[#0057FF]">Caja</span>
          </h1>
          <p className="text-slate-500 mt-1">
            {activeSession ? `Sesión: ${activeSession.id}` : "Resumen detallado de transacciones del día."}
          </p>
        </div>

        {/* Desktop keeps its two header actions untouched (S4). On a phone both
            live in the ActionBar, one of them as the single primary (S6). */}
        <div className="hidden lg:flex gap-3">
          <button
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            onClick={() => window.print()}
          >
            <HiOutlineDownload className="text-xl text-emerald-500" />
            Reporte
          </button>
          <button
            onClick={handleCloseSession}
            disabled={!activeSession || isSubmitting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#0057FF] hover:bg-[#004cd4] text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HiOutlineLockClosed className="text-xl" />
            {isSubmitting ? "Cerrando..." : "Cerrar Turno"}
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="max-w-6xl mx-auto mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold text-red-600">{errorMessage}</span>
          <button
            type="button"
            onClick={clearMessages}
            aria-label="Descartar mensaje de error"
            className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-red-400 transition-colors hover:text-red-600 active:bg-red-100 lg:size-auto lg:rounded-none"
          >
            <HiOutlineXCircle size={16} className="size-5 lg:size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {infoMessage && (
        <div className="max-w-6xl mx-auto mb-6 px-4 py-3 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold text-green-600">{infoMessage}</span>
          <button
            type="button"
            onClick={clearMessages}
            aria-label="Descartar mensaje"
            className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-green-400 transition-colors hover:text-green-600 active:bg-green-100 lg:size-auto lg:rounded-none"
          >
            <HiOutlineCheckCircle size={16} className="size-5 lg:size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-8 items-start">
          <section className="lg:col-span-3 bg-white rounded-3xl lg:rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-4 lg:p-8">
            {/* Phone entry point to the count. It replaces seven inputs on the
                surface with one 64px row that says how much is left to count. */}
            <button
              type="button"
              onClick={() => setShowCountSheet(true)}
              className="mb-6 flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition-colors active:bg-amber-100 lg:hidden"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <HiOutlineCalculator size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-amber-900">Conteo físico</span>
                  <span className="block truncate text-[11px] font-bold text-amber-700">
                    {countFilled} de {COUNT_FIELDS.length} montos · toca para contar
                  </span>
                </span>
              </span>
              <HiOutlineChevronRight size={20} className="shrink-0 text-amber-600" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-50 text-[#0057FF] rounded-2xl">
                <HiOutlineCalculator size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Ventas Totales</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {salesData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-3xl border border-transparent bg-slate-50/30 hover:bg-slate-50 hover:border-slate-100 transition-all group"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={`shrink-0 p-3 rounded-2xl ${item.bg} ${item.color} transition-transform`}>
                      {item.icon}
                    </div>
                    <span className="truncate font-bold text-slate-600 text-sm">{item.label}</span>
                  </div>
                  <div className="shrink-0 pl-2 text-right">
                    <p className="font-mono font-bold text-slate-800 tracking-tighter">{item.value}</p>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Neto</span>
                  </div>
                </div>
              ))}
            </div>

            <section className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#0057FF]/10 text-[#0057FF] rounded-2xl">
                  <HiOutlineCalculator size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-800">Resumen Fiscal</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-bold text-slate-500">Base imponible:</span>
                  <span className="text-sm font-black text-slate-700">Bs {r2(fiscalResumen.taxableBase).toFixed(2)}</span>
                </div>
                {Object.entries(fiscalResumen.vatByRate)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([vat, amount]) => (
                    <div key={vat} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <span className="text-sm font-bold text-slate-500">IVA {vat}%:</span>
                      <span className="text-sm font-black text-slate-700">Bs {r2(amount).toFixed(2)}</span>
                    </div>
                  ))}
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-bold text-slate-500">Monto exento:</span>
                  <span className="text-sm font-black text-slate-700">Bs {r2(fiscalResumen.exemptTotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl md:col-span-2">
                  <span className="text-sm font-bold text-slate-700">Total:</span>
                  <span className="text-base font-black text-blue-600">Bs {r2(fiscalResumen.grandTotal).toFixed(2)}</span>
                </div>
                {fiscalResumen.nonFiscal.count > 0 && (
                  <div className="flex justify-between items-center p-3 bg-amber-50 border border-amber-200 rounded-xl md:col-span-2">
                    <span className="text-sm font-bold text-amber-800">
                      Ventas sin comprobante fiscal ({fiscalResumen.nonFiscal.count}):
                    </span>
                    <span className="text-sm font-black text-amber-900">
                      Bs {r2(fiscalResumen.nonFiscal.total).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Desktop-only section: on a phone the count rows open from the
                `Conteo físico` entry point at the top of this card. */}
            <div className="mt-8 hidden pt-8 border-t border-slate-200 lg:block">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <HiOutlineCalculator size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Conteo Físico</h2>
              </div>
              <p className="text-slate-500 text-sm mb-6">
                Ingrese los montos contados físicamente en caja antes de cerrar el turno.
              </p>
              {/* Desktop count grid, unchanged (S4): same two columns, same field
                  order. On a phone the same fields open in `PhysicalCountSheet`. */}
              <div className="grid grid-cols-2 gap-4">
                {COUNT_FIELDS.map(({ field, label }) => (
                  <div key={field}>
                    <label
                      htmlFor={`physical-count-desktop-${field}`}
                      className="text-xs font-bold text-slate-600 mb-1.5 block"
                    >
                      {label}
                    </label>
                    <input
                      id={`physical-count-desktop-${field}`}
                      type="number"
                      inputMode="decimal"
                      value={physicalCount[field] || ""}
                      onChange={(e) => handlePhysicalCountChange(field, e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <HiOutlineCalculator size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Desglose por Método</h2>
              </div>
              <p className="text-slate-500 text-sm mb-6">
                Compare lo esperado por los movimientos contra lo contado. La diferencia total puede venir de un solo método.
              </p>
              {/* Desktop keeps its four-column table byte-identical (S4). */}
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Método</span>
                  <span className="text-right">Esperado</span>
                  <span className="text-right">Contado</span>
                  <span className="text-right">Diferencia</span>
                </div>
                {methodBreakdown.rows.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm font-bold text-slate-400">
                    Sin movimientos ni conteo registrados.
                  </div>
                ) : (
                  methodBreakdown.rows.map((row) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-4 gap-2 px-4 py-3 items-center border-t border-slate-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`p-1.5 rounded-lg ${METHOD_BG[row.key]} ${METHOD_COLORS[row.key]}`}>
                          {METHOD_ICONS[row.key]}
                        </span>
                        <span className="font-bold text-slate-600 text-xs truncate">{METHOD_LABELS[row.key]}</span>
                      </div>
                      <span className="text-right font-mono text-xs text-slate-600">{row.expected.toFixed(2)}</span>
                      <span className="text-right font-mono text-xs font-bold text-slate-800">{row.counted.toFixed(2)}</span>
                      <span
                        className={`text-right font-mono text-xs font-black ${
                          row.difference === 0 ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {row.difference >= 0 ? "+" : ""}
                        {row.difference.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
                <div className="grid grid-cols-4 gap-2 px-4 py-3 items-center border-t border-slate-200 bg-white">
                  <span className="col-span-3 text-xs font-bold text-slate-500">Total esperado fiscal</span>
                  <span className="text-right font-mono text-sm font-black text-slate-800">
                    {methodBreakdown.authoritativeTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Phone composition: one block per method, three legible numbers. */}
              <MobileMethodBreakdown
                rows={methodBreakdown.rows}
                authoritativeTotal={methodBreakdown.authoritativeTotal}
              />
              {methodBreakdown.divergence !== 0 && (
                <div className="mt-3 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
                  <HiOutlineInformationCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-amber-700">
                      Diferencia entre el esperado fiscal y los movimientos
                    </p>
                    <p className="text-[11px] text-amber-700/80 mt-0.5">
                      El esperado por método suma {methodBreakdown.expectedLocalTotal.toFixed(2)} Bs y el saldo
                      teórico del backend es {methodBreakdown.authoritativeTotal.toFixed(2)} Bs.
                    </p>
                  </div>
                  <span className="font-mono text-sm font-black text-amber-700">
                    {methodBreakdown.divergence >= 0 ? "+" : ""}
                    {methodBreakdown.divergence.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </section>

          <aside className="lg:col-span-2 space-y-4 lg:space-y-6">
            <div className="bg-white rounded-3xl lg:rounded-[2.5rem] border-2 border-[#0057FF]/5 shadow-xl shadow-blue-500/5 p-4 lg:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#0057FF]/5 rounded-full -mr-16 -mt-16" />
              <h3 className="text-xs font-black text-[#0057FF] uppercase tracking-[0.2em] mb-6 lg:mb-10 flex items-center gap-2">
                Balance de Caja
              </h3>

              <div className="space-y-4 lg:space-y-8">
                <div>
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Saldo Teórico Bs</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-slate-900 tracking-tighter">
                      {theoreticalBalanceVes.toFixed(2)}
                    </span>
                    <span className="text-[#0057FF] font-bold text-lg font-mono">Bs.</span>
                  </div>
                </div>

                <div className="pt-4 lg:pt-6 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Saldo Teórico USD</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-slate-900 tracking-tighter">
                      {theoreticalBalanceUsd.toFixed(2)}
                    </span>
                    <span className="text-emerald-500 font-bold text-lg font-mono">USD</span>
                  </div>
                  {activeSession?.saldoTeoricoUsd ? (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-400">Efectivo USD</span>
                        <span className="font-mono font-bold text-slate-600">$ {activeSession.saldoTeoricoUsd.efectivo_usd.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-400">Divisa Electrónica USD</span>
                        <span className="font-mono font-bold text-slate-600">$ {activeSession.saldoTeoricoUsd.divisa_electronica_usd.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="pt-4 lg:pt-6 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Físico Bs</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-slate-700 tracking-tighter">
                      {physicalTotalVes.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 lg:pt-6 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Diferencia Bs</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    {/* Neutral when it balances on a phone; the desktop keeps the
                        green it always had (S4). */}
                    <span className={`text-3xl font-black tracking-tighter ${differenceVes === 0 ? "text-slate-400 lg:text-emerald-500" : "text-red-500"}`}>
                      {differenceVes >= 0 ? "+" : ""}{differenceVes.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* El conteo fisico en divisas tambien cierra el turno: sin estas dos
                    filas el cajero escribe los dolares contados y el panel no se mueve,
                    asi que la diferencia del cierre parece ignorarlos. Solo se muestra:
                    la matematica del cierre no cambia. */}
                <div className="pt-4 lg:pt-6 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Físico USD</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-slate-700 tracking-tighter">
                      {physicalTotalUsd.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 lg:pt-6 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Diferencia USD</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-3xl font-black tracking-tighter ${differenceUsd === 0 ? "text-slate-400 lg:text-emerald-500" : "text-red-500"}`}>
                      {differenceUsd >= 0 ? "+" : ""}{differenceUsd.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl lg:rounded-[2rem] p-4 lg:p-6 border border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <HiOutlineLockClosed size={24} />
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Punto de Venta</p>
                  <h4 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Caja Abierta</h4>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100/50 rounded-full border border-emerald-200/50">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">Activa</span>
              </div>
            </div>

            <div className="flex gap-3 px-4 py-2 bg-blue-50/50 rounded-2xl border border-blue-100/50">
              <HiOutlineInformationCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
              <p className="text-blue-700/80 text-[11px] font-medium leading-relaxed">
                Verifica los montos físicos antes de procesar el cierre. Esta acción es irreversible.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* The fixed bar must not cover the last card (S6). */}
      <div aria-hidden="true" className="h-[var(--action-bar-block-size)] lg:hidden" />

      {/* One primary action carrying the total difference, plus the report one
          tap away. Before this the phone exposed nine controls and the two
          header buttons duplicated the ones that mattered (S6). */}
      <ActionBar
        stacked
        primary={
          <button
            type="button"
            onClick={handleCloseSession}
            disabled={!activeSession || isSubmitting}
            className="flex flex-col items-center justify-center rounded-2xl bg-[#0057FF] px-4 text-white transition-colors active:bg-[#0046CC] disabled:bg-slate-300 disabled:text-slate-500"
          >
            <span className="text-sm font-black leading-tight">
              {isSubmitting ? "Cerrando..." : "Cerrar turno"}
            </span>
            <span className="text-[11px] font-bold leading-tight">
              {isSubmitting ? "Un momento" : differenceSummary}
            </span>
          </button>
        }
        secondary={[
          <button
            key="report"
            type="button"
            onClick={() => window.print()}
            aria-label="Imprimir reporte de cierre"
            title="Imprimir reporte de cierre"
            className="flex items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors active:bg-slate-200"
          >
            <HiOutlineDownload size={22} aria-hidden="true" />
          </button>,
        ]}
      />

      <PhysicalCountSheet
        open={showCountSheet}
        onOpenChange={setShowCountSheet}
        counts={physicalCount}
        onChange={handlePhysicalCountChange}
        differenceVes={differenceVes}
        differenceUsd={differenceUsd}
      />
    </div>
  );
}

function mapTransactionToMethod(tx: any): PaymentMethodKey | null {
  const method = (tx.paymentMethod || "").toLowerCase();
  // Backend Rust enum variants: Efectivo, TarjetaDebito, TarjetaCredito, Transferencia,
  // Cheque, Biopago, DivisaElectronica, Credito (cuenta por cobrar).
  if (method.includes("efectivo")) {
    return tx.currency === "USD" ? "dolares" : "efectivo";
  }
  if (method.includes("divisa") && method.includes("electronica")) return "divisa_electronica";
  if (method.includes("tarjeta") || method.includes("debito")) return "tarjeta";
  // "Credito" a secas = cuenta por cobrar; "TarjetaCredito" ya cayó en tarjeta.
  if (method.includes("credito")) return "credito";
  if (method.includes("transferencia") || method.includes("movil")) return "pagomovil";
  if (method.includes("biopago")) return "biopago";
  if (method.includes("cashea")) return "cashea";
  if (tx.currency === "USD") return "dolares";
  return null;
}