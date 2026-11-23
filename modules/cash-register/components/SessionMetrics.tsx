"use client";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { cn } from "@/modules/core/utils/ui";

const getStatusLabel = (status?: string) => {
  switch (status) {
    case "approved":
      return "Aprobada";
    case "pending":
      return "Pendiente";
    case "rejected":
      return "Rechazada";
    default:
      return status || "Desconocido";
  }
};

const tileClass =
  "bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs";
const labelClass = "text-[8px] font-black text-slate-400 uppercase tracking-wider";
const valueClass = "text-[10px] font-black text-slate-700 font-mono mt-0.5";

/**
 * The nine numbers that describe the open cash session.
 *
 * Presentational only: the desktop card renders it as a five/nine-column grid
 * and the mobile overflow sheet renders it as a two-column list after an
 * explicit disclosure. Keeping one copy means the desktop grid keeps its exact
 * markup (spec S4) while the phone never shows nine tiles at once (S6).
 */
export default function SessionMetrics({ className }: { className?: string }) {
  const { activeSession, sessionInvoices, sessionTransactions } = useCashierWorkflowStore();
  const currentRate = useCurrencyStore((s) => s.getEffectiveRate());

  if (!activeSession) return null;

  return (
    <div className={cn("grid gap-2", className)}>
      <div className={tileClass}>
        <span className={labelClass}>Sesion</span>
        <span className={`${valueClass} truncate`} title={activeSession.id}>
          {activeSession.id}
        </span>
      </div>
      <div className={tileClass}>
        <span className={labelClass}>Estado</span>
        <span className="text-[10px] font-black text-emerald-600 mt-0.5">
          {getStatusLabel(activeSession.approvalStatus)}
        </span>
      </div>
      <div className={tileClass}>
        <span className={labelClass}>Apertura Bs</span>
        <span className={valueClass}>{activeSession.openingAmountVes.toFixed(2)}</span>
      </div>
      <div className={tileClass}>
        <span className={labelClass}>Apertura USD</span>
        <span className={valueClass}>{activeSession.openingAmountUsd.toFixed(2)}</span>
      </div>
      <div className={tileClass}>
        <span className={labelClass}>Saldo teorico Bs</span>
        <span className={valueClass}>{activeSession.theoreticalAmountVes.toFixed(2)}</span>
      </div>
      <div className={tileClass}>
        <span className={labelClass}>Saldo teorico USD</span>
        {activeSession.saldoTeoricoUsd ? (
          <div className="mt-0.5 space-y-0.5">
            <div className="text-[10px] font-black text-slate-700 font-mono leading-tight">
              Efc $ {activeSession.saldoTeoricoUsd.efectivo_usd.toFixed(2)}
            </div>
            <div className="text-[10px] font-black text-slate-500 font-mono leading-tight">
              Div $ {activeSession.saldoTeoricoUsd.divisa_electronica_usd.toFixed(2)}
            </div>
          </div>
        ) : (
          <span className={valueClass}>{activeSession.theoreticalAmountUsd.toFixed(2)}</span>
        )}
      </div>
      <div className={tileClass}>
        <span className={labelClass}>Facturas del turno</span>
        <span className={valueClass}>{sessionInvoices.length}</span>
      </div>
      <div className={tileClass}>
        <span className={labelClass}>Movimientos del turno</span>
        <span className={valueClass}>{sessionTransactions.length}</span>
      </div>
      <div className={tileClass}>
        <span className={labelClass}>Tasa</span>
        <span className={valueClass}>{currentRate.toFixed(2)}</span>
      </div>
    </div>
  );
}
