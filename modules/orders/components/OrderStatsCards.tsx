"use client";
import { HiOutlineCash, HiOutlineClipboardList, HiOutlineCheckCircle, HiOutlineClock } from "react-icons/hi";
import { OrderStats } from "../services/OrderService";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

interface OrderStatsCardsProps {
  stats: OrderStats;
  loading: boolean;
}

export default function OrderStatsCards({ stats, loading }: OrderStatsCardsProps) {
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const formattedSales = isDollar 
    ? `$ ${stats.totalSales.toFixed(2)}` 
    : `Bs ${(stats.totalSales * rate).toFixed(2)}`;

  const cards = [
    {
      title: "Ventas Totales",
      value: formattedSales,
      icon: <HiOutlineCash className="w-5 h-5 text-[#4A69BD]" />,
    },
    {
      title: "Total Órdenes",
      value: stats.totalOrders.toString(),
      icon: <HiOutlineClipboardList className="w-5 h-5 text-[#4A69BD]" />,
    },
    {
      title: "Completadas",
      value: stats.completedOrders.toString(),
      icon: <HiOutlineCheckCircle className="w-5 h-5 text-emerald-500" />,
    },
    {
      title: "Pendientes",
      value: stats.pendingOrders.toString(),
      icon: <HiOutlineClock className="w-5 h-5 text-amber-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
        >
          <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
            {card.icon}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.title}</span>
            <span className="text-xl font-bold text-slate-800">{loading ? "---" : card.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
