"use client";
import type { ReactNode } from "react";
import { HiOutlineCash, HiOutlineClipboardList, HiOutlineCheckCircle, HiOutlineClock, HiOutlineCreditCard, HiOutlineExclamationCircle, HiOutlineXCircle } from "react-icons/hi";
import { OrderStats } from "../services/OrderService";
import type { SearchOrdersTotals } from "../hooks/useOrders";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

interface OrderStatsCardsProps {
  stats: OrderStats;
  /**
   * Whole-filter-set totals from the search response, in USD. Unlike `stats`, they
   * are NOT limited to the loaded infinite-query window: the sales card relies on
   * them so it never under-reports just because more pages are still unloaded.
   * `null` until the first page arrives (or if the backend omits them).
   */
  scopeTotals: SearchOrdersTotals | null;
  loading: boolean;
}

/**
 * The per-status counters describe the orders currently loaded into the list (the
 * flattened infinite-query window), NOT the pharmacy's full history, so they keep
 * their loaded-window labels ("Órdenes Cargadas", etc.). The "Ventas Netas" card is
 * the exception: it renders the server's whole-scope `totals.sales` (gross minus
 * returns) and shows the gross and returned amounts underneath so the figure can be
 * audited instead of taken on faith.
 */
export default function OrderStatsCards({ stats, scopeTotals, loading }: OrderStatsCardsProps) {
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const formatAmount = (amount: number) =>
    isDollar
      ? `$ ${amount.toFixed(2)}`
      : `Bs ${(amount * rate).toFixed(2)}`;

  const scopeSales = scopeTotals?.sales;
  const scopeGross = scopeTotals?.sales_gross;
  const scopeReturned = scopeTotals?.sales_returned;

  // The net figure is the backend's; if the scope totals are missing we show
  // "---" rather than falling back to the in-memory window, which is exactly the
  // phantom-revenue number this card is being fixed to stop showing.
  const salesValue =
    typeof scopeSales === "number" ? formatAmount(scopeSales) : "---";

  const salesBreakdown =
    typeof scopeGross === "number" && typeof scopeReturned === "number"
      ? `Bruto ${formatAmount(scopeGross)} · Devuelto −${formatAmount(scopeReturned)}`
      : undefined;

  const cards: Array<{
    title: string;
    value: string;
    icon: ReactNode;
    /** Auditable sub-line under the headline figure; only the sales card needs one. */
    breakdown?: string;
  }> = [
    {
      title: "Ventas Netas · Todo el Filtro",
      value: salesValue,
      breakdown: salesBreakdown,
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
            {!loading && card.breakdown ? (
              <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">{card.breakdown}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
