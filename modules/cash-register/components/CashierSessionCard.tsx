"use client";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { resolveAuthorizedCajaId } from "@/modules/cash-register/lib/cash-session-binding";
import SessionMetrics from "@/modules/cash-register/components/SessionMetrics";
import { useRouter } from "next/navigation";
import { 
  HiOutlineCash, 
  HiOutlineCheckCircle, 
  HiOutlineClock, 
  HiOutlineXCircle, 
  HiRefresh, 
  HiCheckCircle, 
  HiOutlinePrinter 
} from "react-icons/hi";

export default function CashierSessionCard() {
  const router = useRouter();
  const {
    cashBoxes,
    activeSession,
    selectedCashBoxId,
    selectCashBox,
    openSession,
    isSubmitting,
    errorMessage,
    infoMessage,
    clearMessages,
    sessionInvoices,
    load,
  } = useCashierWorkflowStore();

  const currentRate = useCurrencyStore((s) => s.getEffectiveRate());

  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId ?? profile?.id_group;

  const hasApprovedSession = activeSession?.approvalStatus === "approved";
  const hasPendingSession = activeSession?.approvalStatus === "pending";

  // P2 cash-session-attribution: la caja a la que este terminal está atado,
  // visible para que una atadura equivocada salte a la vista del cajero. Fuente
  // única: la caja asignada al usuario (`agents.cajaId`), lo único que el backend
  // autoriza para consultar por caja.
  const boundCajaId = resolveAuthorizedCajaId(profile?.cajaId);
  const boundCajaLabel = boundCajaId
    ? activeSession?.cashBoxName ||
      cashBoxes.find((cb) => cb.id === boundCajaId)?.name ||
      boundCajaId
    : null;

  const totalSold = sessionInvoices.reduce((sum, inv) => sum + inv.totalVes, 0);
  const invoiceCount = sessionInvoices.length;

  const handleRefresh = async () => {
    if (pharmacyId) {
      await load(pharmacyId);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
      {/* Encabezado del Turno */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#0057FF] rounded-full inline-block"></span>
          Turno del cajero
        </h2>
        {/* Mobile keeps the card informational; refreshing the session lives in
            the overflow sheet so the screen stays within its action budget (S6). */}
        <button
          onClick={handleRefresh}
          className="hidden lg:flex text-xs font-bold text-[#0057FF] hover:text-blue-800 transition-colors items-center gap-1.5"
        >
          <HiRefresh className="animate-hover-spin" size={14} />
          Actualizar
        </button>
      </div>

      {/* Atadura caja↔terminal (P2 cash-session-attribution) */}
      {boundCajaId ? (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
            Este terminal está atado a la caja
          </span>
          <span
            className="max-w-full truncate text-[10px] font-black text-[#0057FF] bg-[#f0f7ff] border border-blue-100/60 px-2.5 py-1 rounded-full"
            title={boundCajaId}
          >
            {boundCajaLabel}
          </span>
          {activeSession?.id && (
            <span className="text-[10px] font-bold text-slate-400 font-mono" title={activeSession.id}>
              Sesión {activeSession.id.slice(0, 8)}
            </span>
          )}
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider">
            Sin caja asignada a este usuario
          </span>
          <span className="text-[10px] font-bold text-amber-600">
            La sesión se resuelve por usuario; con más de una caja abierta el
            sistema va a pedir que se elija una, en vez de adivinar.
          </span>
          {activeSession?.id && (
            <span className="text-[10px] font-bold text-slate-400 font-mono" title={activeSession.id}>
              Sesión {activeSession.id.slice(0, 8)}
            </span>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold text-red-600">{errorMessage}</span>
          {/* 44×44 under `lg` (spec S3): a 16px icon alone is below the 24px
              floor. Desktop keeps its bare icon (spec S4). */}
          <button
            onClick={clearMessages}
            aria-label="Descartar el aviso"
            className="text-red-400 hover:text-red-600 max-lg:flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center max-lg:justify-center"
          >
            <HiOutlineXCircle size={16} />
          </button>
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold text-green-600">{infoMessage}</span>
          <button
            onClick={clearMessages}
            aria-label="Descartar el aviso"
            className="text-green-400 hover:text-green-600 max-lg:flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center max-lg:justify-center"
          >
            <HiOutlineCheckCircle size={16} />
          </button>
        </div>
      )}

      {/* No hay sesión activa */}
      {!activeSession && (
        <div className="flex items-center gap-4 flex-wrap bg-[#f8fafc] p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2">
            <HiOutlineCash size={18} className="text-slate-400" />
            <span className="text-xs font-black text-slate-500">Caja:</span>
          </div>
          {/* `min-w-0` + `max-w-full` let the select shrink below the intrinsic
              width of its longest option (`code - name`) instead of widening the
              wrapped row past the card; below `lg` it takes its own full-width
              line and keeps a 44px target (spec S3). */}
          <select
            value={selectedCashBoxId ?? ""}
            onChange={(e) => selectCashBox(e.target.value || null)}
            className="min-w-0 max-w-full truncate px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 max-lg:min-h-11 max-lg:w-full"
          >
            <option value="">Seleccionar caja</option>
            {cashBoxes.map((cb) => (
              <option key={cb.id} value={cb.id}>
                {cb.code} - {cb.name}
              </option>
            ))}
          </select>
          <button
            onClick={openSession}
            disabled={!selectedCashBoxId || isSubmitting}
            className="px-5 py-2 bg-[#0057FF] text-white rounded-xl font-black text-xs hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Enviando..." : "Solicitar Apertura"}
          </button>
          {currentRate > 0 && (
            <span className="ml-auto text-xs font-bold text-slate-400">
              Tasa: {currentRate.toFixed(2)} Bs/USD
            </span>
          )}
        </div>
      )}

      {/* Sesión pendiente de aprobación */}
      {hasPendingSession && (
        <div className="flex items-center gap-3 bg-amber-50/50 border border-amber-100 p-4 rounded-2xl">
          <HiOutlineClock size={20} className="text-amber-500" />
          <span className="text-xs font-black text-amber-600">
            Apertura pendiente de aprobación por administración
          </span>
        </div>
      )}

      {/* Sesión activa aprobada */}
      {hasApprovedSession && activeSession && (
        <div className="bg-[#f0f7ff] border border-blue-100/50 p-4 rounded-[24px]">
          {/* Fila del Titulo de Sesion Activa y Cierre */}
          <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <HiCheckCircle size={18} className="text-[#0057FF]" />
              <span className="text-xs font-black text-[#0057FF] tracking-tight">
                Sesion activa en prueba
              </span>
            </div>
            <button
              onClick={() => router.push("/cierre-caja")}
              className="hidden lg:flex items-center gap-1.5 px-4 py-1.5 bg-white border border-[#0057FF] text-[#0057FF] hover:bg-blue-50/50 rounded-full font-black text-[10px] tracking-wide shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
            >
              <HiOutlinePrinter size={13} />
              Ir a cierre
            </button>
          </div>

          {/* Phone: only the three numbers the cashier needs at the counter.
              The whole breakdown lives in the overflow sheet (S6). */}
          <dl className="grid grid-cols-3 gap-2 lg:hidden">
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5">
              <dt className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Vendido Bs</dt>
              <dd className="text-xs font-black text-slate-800 font-mono mt-0.5 truncate">
                {totalSold.toFixed(2)}
              </dd>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5">
              <dt className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Facturas</dt>
              <dd className="text-xs font-black text-slate-800 font-mono mt-0.5">{invoiceCount}</dd>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5">
              <dt className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Saldo Bs</dt>
              <dd className="text-xs font-black text-slate-800 font-mono mt-0.5 truncate">
                {activeSession.theoreticalAmountVes.toFixed(2)}
              </dd>
            </div>
          </dl>

          {/* Desktop keeps the nine-metric grid exactly as before (S4). */}
          <SessionMetrics className="hidden lg:grid lg:grid-cols-5 xl:grid-cols-9" />
        </div>
      )}
    </div>
  );
}
