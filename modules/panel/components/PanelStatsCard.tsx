import { HiOutlineUsers, HiOutlineShoppingBag, HiOutlineCurrencyDollar, HiOutlineXCircle, HiOutlineTrendingUp } from "react-icons/hi";
import { DashboardStatCard } from "./DashboardStatCard";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

interface PanelStatsCardsProps {
  totalUsers: number;
  totalOrders: number;
  totalSales: number;
  canceledOrders: number;
  trends: {
    salesGrowth: number;
    ordersGrowth: number;
    usersGrowth: number;
  };
  salesTrend: { month: string; ventas: number; ordenes: number }[];
}

export default function PanelStatsCards({ totalUsers, totalOrders, totalSales, canceledOrders, trends, salesTrend }: PanelStatsCardsProps) {
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const formatValue = (amount: number) => {
    if (isDollar) return `$ ${amount.toFixed(2)}`;
    return `Bs ${(amount * rate).toFixed(2)}`;
  };

  const totalEarnings = totalSales * 0.30;

  const formatTrend = (val: number) => {
    const sign = val >= 0 ? "+" : "";
    return `${sign}${val.toFixed(1)}%`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
      <DashboardStatCard
        title="Total Usuarios"
        value={totalUsers}
        icon={<HiOutlineUsers />}
        color="blue"
        trend={{ value: formatTrend(trends.usersGrowth), label: "vs. mes anterior", type: trends.usersGrowth >= 0 ? "up" : "down" }}
      />
      <DashboardStatCard
        title="Total de Ordenes"
        value={totalOrders}
        icon={<HiOutlineShoppingBag />}
        color="indigo"
        trend={{ value: formatTrend(trends.ordersGrowth), label: "vs. mes anterior", type: trends.ordersGrowth >= 0 ? "up" : "down" }}
      />
      <DashboardStatCard
        title="Total de Ventas"
        value={formatValue(totalSales)}
        icon={<HiOutlineCurrencyDollar />}
        color="emerald"
        trend={{ value: formatTrend(trends.salesGrowth), label: "vs. mes anterior", type: trends.salesGrowth >= 0 ? "up" : "down" }}
      />
      <DashboardStatCard
        title="Mis Ganancias (30%)"
        value={formatValue(totalEarnings)}
        icon={<HiOutlineTrendingUp />}
        color="blue"
        trend={{ value: formatTrend(trends.salesGrowth), label: "vs. mes anterior", type: trends.salesGrowth >= 0 ? "up" : "down" }}
      />
      <DashboardStatCard
        title="Total Canceladas"
        value={canceledOrders}
        icon={<HiOutlineXCircle />}
        color="rose"
        trend={{ value: `${totalOrders > 0 ? ((canceledOrders / totalOrders) * 100).toFixed(1) : "0"}%`, label: "del total", type: "down" }}
      />
    </div>
  );
}
