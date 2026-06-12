"use client";
import { HiTrash, HiCheck } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

export default function CheckoutBar({ onCheckout }: { onCheckout?: () => void }) {
  const { getComputedTotals, getCurrentOrder, deleteAllOrders } = useCurrentOrderStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();

  const totals = getComputedTotals();
  const order = getCurrentOrder();
  const rate = getEffectiveRate();

  return (
    <div className="bg-[#0055ff] text-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Izquierda: Cantidad de Productos */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-100 uppercase tracking-wide">
          Productos en la venta actual:
        </span>
        <span className="text-base font-black text-white bg-white/10 px-2.5 py-0.5 rounded-lg font-mono">
          {totals.itemCount}
        </span>
      </div>

      {/* Derecha: Total, Eliminar Ticket y Procesar */}
      <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-blue-100 uppercase tracking-wide">
            Total de venta:
          </span>
          <div className="bg-white rounded-xl px-4 py-2 flex items-center gap-1.5 shadow-sm">
            <span className="text-[9px] font-black bg-[#0055ff]/10 text-[#0055ff] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
              {isDollar ? "USD" : "Bs"}
            </span>
            <span className="text-base font-black text-[#0055ff] font-mono leading-none">
              {isDollar ? (totals.total / (rate || 1)).toFixed(2) : totals.total.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={deleteAllOrders}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-700/40 hover:bg-blue-700/60 border border-blue-400/20 text-white rounded-full font-black text-xs transition-all hover:scale-105 active:scale-95"
            title="Eliminar Todo"
          >
            <HiTrash size={14} />
            Eliminar Ticket
          </button>
          <button
            onClick={onCheckout}
            disabled={!order?.medications.length}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-white text-[#0055ff] disabled:text-slate-400 disabled:bg-white/80 font-black text-xs rounded-full hover:scale-105 active:scale-95 transition-all shadow-md disabled:cursor-not-allowed cursor-pointer"
          >
            <HiCheck size={16} />
            Procesar
          </button>
        </div>
      </div>
    </div>
  );
}
