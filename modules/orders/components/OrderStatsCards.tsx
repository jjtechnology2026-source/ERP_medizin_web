"use client";
import { HiOutlineCash, HiOutlineClipboardList, HiOutlineCheckCircle, HiOutlineClock, HiOutlineCreditCard, HiOutlineExclamationCircle, HiOutlineXCircle } from "react-icons/hi";
import { OrderStats } from "../services/OrderService";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

interface OrderStatsCardsProps {
  stats: OrderStats;
  loading: boolean;
}

/**
 * Every card describes the orders currently loaded into the list (the flattened
 * infinite-query window), NOT the pharmacy's full history. `stats.totalOrders` is the
 * loaded-page count, so the total card is labelled "Órdenes Cargadas" instead of the
 * misleading "Total Órdenes"; the server's full count lives in the hook's `total`.
 */
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
      title: "Órdenes Cargadas",
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
    {
      // Money already collected with the sale not yet finished: kept individually
      // visible because losing sight of a paid order costs actual money. Sky is the
      // same family the table uses for the "Pagado" status chip.
      title: "Pagadas",
      value: stats.paidOrders.toString(),
      icon: <HiOutlineCreditCard className="w-5 h-5 text-sky-500" />,
    },
    {
      title: "Canceladas",
      value: stats.cancelledOrders.toString(),
      icon: <HiOutlineXCircle className="w-5 h-5 text-slate-500" />,
    },
    {
      title: "Fallidas",
      value: stats.failedOrders.toString(),
      icon: <HiOutlineExclamationCircle className="w-5 h-5 text-red-600" />,
    },
  ];

  /* 7 cards: use 4 columns above `md` so the rows are 4 + 3. Two or three columns
     would leave a lone card (2+2+2+1 / 3+3+1); 4 is the widest split that stays
     readable for these compact cards. Below `md` the cards stack full width. */
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
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
