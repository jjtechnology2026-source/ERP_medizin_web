"use client";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
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
    sessionTransactions,
    currentRate,
    load,
  } = useCashierWorkflowStore();

  const profile = useAuthStore((s) => s.profile);
  const pharmacyId = profile?.pharmacyId ?? profile?.id_group;

  const hasApprovedSession = activeSession?.approvalStatus === "approved";
  const hasPendingSession = activeSession?.approvalStatus === "pending";

  const totalSold = sessionInvoices.reduce((sum, inv) => sum + inv.totalVes, 0);
  const invoiceCount = sessionInvoices.length;

  const handleRefresh = async () => {
    if (pharmacyId) {
      await load(pharmacyId);
    }
  };

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

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
      {/* Encabezado del Turno */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#0055ff] rounded-full inline-block"></span>
          Turno del cajero
        </h2>
        <button
          onClick={handleRefresh}
          className="text-xs font-bold text-[#0055ff] hover:text-blue-800 transition-colors flex items-center gap-1.5"
        >
          <HiRefresh className="animate-hover-spin" size={14} />
          Actualizar
        </button>
      </div>

      {errorMessage && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold text-red-600">{errorMessage}</span>
          <button onClick={clearMessages} className="text-red-400 hover:text-red-600">
            <HiOutlineXCircle size={16} />
          </button>
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold text-green-600">{infoMessage}</span>
          <button onClick={clearMessages} className="text-green-400 hover:text-green-600">
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
          <select
            value={selectedCashBoxId ?? ""}
            onChange={(e) => selectCashBox(e.target.value || null)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
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
            className="px-5 py-2 bg-[#0055ff] text-white rounded-xl font-black text-xs hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <HiCheckCircle size={18} className="text-[#0055ff]" />
              <span className="text-xs font-black text-[#0055ff] tracking-tight">
                Sesion activa en prueba
              </span>
            </div>
            <button
              onClick={() => router.push("/cierre-caja")}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-[#0055ff] text-[#0055ff] hover:bg-blue-50/50 rounded-full font-black text-[10px] tracking-wide shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
            >
              <HiOutlinePrinter size={13} />
              Ir a cierre
            </button>
          </div>

          {/* Grid de 9 Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-2">
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Sesion</span>
              <span className="text-[10px] font-black text-slate-700 font-mono truncate mt-0.5" title={activeSession.id}>
                {activeSession.id}
              </span>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Estado</span>
              <span className="text-[10px] font-black text-emerald-600 mt-0.5">
                {getStatusLabel(activeSession.approvalStatus)}
              </span>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Apertura Bs</span>
              <span className="text-[10px] font-black text-slate-700 font-mono mt-0.5">
                {activeSession.openingAmountVes.toFixed(2)}
              </span>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Apertura USD</span>
              <span className="text-[10px] font-black text-slate-700 font-mono mt-0.5">
                {activeSession.openingAmountUsd.toFixed(2)}
              </span>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Saldo teorico Bs</span>
              <span className="text-[10px] font-black text-slate-700 font-mono mt-0.5">
                {activeSession.theoreticalAmountVes.toFixed(2)}
              </span>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Saldo teorico USD</span>
              <span className="text-[10px] font-black text-slate-700 font-mono mt-0.5">
                {activeSession.theoreticalAmountUsd.toFixed(2)}
              </span>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Facturas del turno</span>
              <span className="text-[10px] font-black text-slate-700 font-mono mt-0.5">
                {invoiceCount}
              </span>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Movimientos del turno</span>
              <span className="text-[10px] font-black text-slate-700 font-mono mt-0.5">
                {sessionTransactions.length}
              </span>
            </div>
            <div className="bg-white border border-slate-100/60 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Tasa</span>
              <span className="text-[10px] font-black text-slate-700 font-mono mt-0.5">
                {currentRate.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
