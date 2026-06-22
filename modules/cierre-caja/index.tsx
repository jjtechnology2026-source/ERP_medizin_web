"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import {
  HiOutlineDownload,
  HiOutlineLockClosed,
  HiOutlineCash,
  HiOutlineCreditCard,
  HiOutlineCurrencyDollar,
  HiOutlineDeviceMobile,
  HiOutlineFingerPrint,
  HiOutlineCalculator,
  HiOutlineInformationCircle,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
} from "react-icons/hi";

const r2 = (n: number) => Math.round(n * 100) / 100;

type PaymentMethodKey = "efectivo" | "dolares" | "tarjeta" | "pagomovil" | "biopago";

interface PhysicalCount {
  efectivo_ves: number;
  efectivo_usd: number;
  tarjeta_ves: number;
  otros_ves: number;
}

const METHOD_ICONS: Record<PaymentMethodKey, React.ReactNode> = {
  efectivo: <HiOutlineCash />,
  dolares: <HiOutlineCurrencyDollar />,
  tarjeta: <HiOutlineCreditCard />,
  pagomovil: <HiOutlineDeviceMobile />,
  biopago: <HiOutlineFingerPrint />,
};

const METHOD_LABELS: Record<PaymentMethodKey, string> = {
  efectivo: "Efectivo Bs.",
  dolares: "Divisas $",
  tarjeta: "Tarjetas",
  pagomovil: "Pago Móvil",
  biopago: "Biopago",
};

const METHOD_COLORS: Record<PaymentMethodKey, string> = {
  efectivo: "text-emerald-500",
  dolares: "text-blue-500",
  tarjeta: "text-purple-500",
  pagomovil: "text-pink-500",
  biopago: "text-orange-500",
};

const METHOD_BG: Record<PaymentMethodKey, string> = {
  efectivo: "bg-emerald-50",
  dolares: "bg-blue-50",
  tarjeta: "bg-purple-50",
  pagomovil: "bg-pink-50",
  biopago: "bg-orange-50",
};

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

  const [physicalCount, setPhysicalCount] = useState<PhysicalCount>({
    efectivo_ves: 0,
    efectivo_usd: 0,
    tarjeta_ves: 0,
    otros_ves: 0,
  });

  const totalsByMethod = sessionTransactions.reduce(
    (acc, tx) => {
      if (tx.voided) return acc;
      const method = mapTransactionToMethod(tx);
      if (method) {
        acc[method] = (acc[method] || 0) + tx.amountVes;
      }
      return acc;
    },
    { efectivo: 0, dolares: 0, tarjeta: 0, pagomovil: 0, biopago: 0 } as Record<PaymentMethodKey, number>
  );

  const theoreticalTotalVes = Object.values(totalsByMethod).reduce((a, b) => a + b, 0);
  const theoreticalTotalUsd = sessionTransactions
    .filter((tx) => tx.currency === "USD" && !tx.voided)
    .reduce((sum, tx) => sum + tx.originalAmount, 0);

  const theoreticalBalanceVes = (activeSession?.openingAmountVes ?? 0) + theoreticalTotalVes;
  const theoreticalBalanceUsd = (activeSession?.openingAmountUsd ?? 0) + theoreticalTotalUsd;

  const physicalTotalVes = physicalCount.efectivo_ves + physicalCount.tarjeta_ves + physicalCount.otros_ves;
  const physicalTotalUsd = physicalCount.efectivo_usd;

  const differenceVes = physicalTotalVes - theoreticalBalanceVes;
  const differenceUsd = physicalTotalUsd - theoreticalBalanceUsd;

  const formatPrice = (amount: number) => `Bs ${amount.toFixed(2)}`;
  const formatUsd = (amount: number) => `$ ${amount.toFixed(2)}`;

  const handlePhysicalCountChange = (field: keyof PhysicalCount, value: string) => {
    const num = parseFloat(value) || 0;
    setPhysicalCount((prev) => ({ ...prev, [field]: num }));
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;

    await requestCloseSession(
      {
        efectivo_ves: physicalCount.efectivo_ves,
        tarjeta_ves: physicalCount.tarjeta_ves,
        otros_ves: physicalCount.otros_ves,
        efectivo_usd: physicalCount.efectivo_usd,
        tarjeta_usd: 0,
        otros_usd: 0,
      },
      {
        observations: "Cierre de turno",
        openNewTurn: false,
      }
    );
  };

  const salesData = (Object.keys(METHOD_LABELS) as PaymentMethodKey[]).map((method) => ({
    label: METHOD_LABELS[method],
    value: method === "dolares" ? `${(totalsByMethod[method] / (currentRate || 1)).toFixed(2)} USD` : totalsByMethod[method].toFixed(2),
    icon: METHOD_ICONS[method],
    color: METHOD_COLORS[method],
    bg: METHOD_BG[method],
  }));

  const fiscalResumen = useMemo(() => {
    const result = sessionInvoices.flatMap((inv) => inv.lines).reduce(
      (acc, line) => {
        const lineTotal = line.unitPriceVes * line.quantity;
        const taxAmount =
          line.vatPercentage > 0
            ? lineTotal * line.vatPercentage / (100 + line.vatPercentage)
            : 0;
        if (line.vatPercentage === 0) {
          acc.exemptTotal += lineTotal;
        } else {
          acc.taxableBase += lineTotal - taxAmount;
          acc.vatByRate[line.vatPercentage] = r2(
            (acc.vatByRate[line.vatPercentage] || 0) + taxAmount
          );
        }
        acc.grandTotal += lineTotal;
        return acc;
      },
      { taxableBase: 0, exemptTotal: 0, vatByRate: {} as Record<number, number>, grandTotal: 0 }
    );
    return {
      ...result,
      taxableBase: r2(result.taxableBase),
      exemptTotal: r2(result.exemptTotal),
    };
  }, [sessionInvoices]);

  useEffect(() => {
    if (!activeSession) {
      router.push("/caja-ventas");
    }
  }, [activeSession, router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-10 font-sans text-slate-900">
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-800">
            Cierre de <span className="text-[#005eff]">Caja</span>
          </h1>
          <p className="text-slate-500 mt-1">
            {activeSession ? `Sesión: ${activeSession.id}` : "Resumen detallado de transacciones del día."}
          </p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#005eff] hover:bg-[#004cd4] text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HiOutlineLockClosed className="text-xl" />
            {isSubmitting ? "Cerrando..." : "Cerrar Turno"}
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="max-w-6xl mx-auto mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold text-red-600">{errorMessage}</span>
          <button onClick={clearMessages} className="text-red-400 hover:text-red-600">
            <HiOutlineXCircle size={16} />
          </button>
        </div>
      )}

      {infoMessage && (
        <div className="max-w-6xl mx-auto mb-6 px-4 py-3 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold text-green-600">{infoMessage}</span>
          <button onClick={clearMessages} className="text-green-400 hover:text-green-600">
            <HiOutlineCheckCircle size={16} />
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <section className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-50 text-[#005eff] rounded-2xl">
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
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${item.bg} ${item.color} transition-transform`}>
                      {item.icon}
                    </div>
                    <span className="font-bold text-slate-600 text-sm">{item.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-800 tracking-tighter">{item.value}</p>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Neto</span>
                  </div>
                </div>
              ))}
            </div>

            <section className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#005eff]/10 text-[#005eff] rounded-2xl">
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
              </div>
            </section>

            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <HiOutlineCalculator size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Conteo Físico</h2>
              </div>
              <p className="text-slate-500 text-sm mb-6">
                Ingrese los montos contados físicamente en caja antes de cerrar el turno.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Efectivo Bs</label>
                  <input
                    type="number"
                    value={physicalCount.efectivo_ves || ""}
                    onChange={(e) => handlePhysicalCountChange("efectivo_ves", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Efectivo USD</label>
                  <input
                    type="number"
                    value={physicalCount.efectivo_usd || ""}
                    onChange={(e) => handlePhysicalCountChange("efectivo_usd", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Tarjeta Bs</label>
                  <input
                    type="number"
                    value={physicalCount.tarjeta_ves || ""}
                    onChange={(e) => handlePhysicalCountChange("tarjeta_ves", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Otros Bs (Pago móvil, biopago)</label>
                  <input
                    type="number"
                    value={physicalCount.otros_ves || ""}
                    onChange={(e) => handlePhysicalCountChange("otros_ves", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[2.5rem] border-2 border-[#005eff]/5 shadow-xl shadow-blue-500/5 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#005eff]/5 rounded-full -mr-16 -mt-16" />
              <h3 className="text-xs font-black text-[#005eff] uppercase tracking-[0.2em] mb-10 flex items-center gap-2">
                Balance de Caja
              </h3>

              <div className="space-y-8">
                <div>
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Saldo Teórico Bs</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-slate-900 tracking-tighter">
                      {theoreticalBalanceVes.toFixed(2)}
                    </span>
                    <span className="text-[#005eff] font-bold text-lg font-mono">Bs.</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Saldo Teórico USD</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-slate-900 tracking-tighter">
                      {theoreticalBalanceUsd.toFixed(2)}
                    </span>
                    <span className="text-emerald-500 font-bold text-lg font-mono">USD</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Físico Bs</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-slate-700 tracking-tighter">
                      {physicalTotalVes.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Diferencia Bs</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-3xl font-black tracking-tighter ${differenceVes === 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {differenceVes >= 0 ? "+" : ""}{differenceVes.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 border border-slate-200 flex items-center justify-between shadow-sm">
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
    </div>
  );
}

function mapTransactionToMethod(tx: any): PaymentMethodKey | null {
  const method = (tx.paymentMethod || "").toLowerCase();
  if (method.includes("efectivo")) return "efectivo";
  if (method.includes("tarjeta") || method.includes("debito") || method.includes("credito")) return "tarjeta";
  if (method.includes("movil") || method.includes("transferencia")) return "pagomovil";
  if (method.includes("biopago")) return "biopago";
  if (tx.currency === "USD") return "dolares";
  return null;
}