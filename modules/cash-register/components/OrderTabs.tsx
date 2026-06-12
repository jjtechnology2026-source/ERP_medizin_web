"use client";
import { HiPlus } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";

export default function OrderTabs() {
  const { orders, currentOrderIndex, switchOrder, newOrder } = useCurrentOrderStore();

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {orders.map((order, i) => (
        <button
          key={i}
          onClick={() => switchOrder(i)}
          className={`px-4 py-2 rounded-lg font-black text-[10px] tracking-wider uppercase transition-all whitespace-nowrap ${
            currentOrderIndex === i
              ? "bg-[#00d2ff] text-white shadow-xs"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          Orden {i + 1}
          <span className="ml-1.5 text-[9px] opacity-80">({order.medications.length})</span>
        </button>
      ))}
      <button
        onClick={newOrder}
        className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0055ff] text-white hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xs shrink-0"
        title="Nueva Orden"
      >
        <HiPlus size={13} />
      </button>
    </div>
  );
}
