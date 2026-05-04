import { HiOutlineUsers, HiOutlineShoppingBag, HiOutlineCurrencyDollar, HiOutlineXCircle } from "react-icons/hi";
import { DashboardStatCard } from "./DashboardStatCard";

interface PanelStatsCardsProps {
  totalUsers: number;
  totalOrders: number;
  totalSales: number;
  canceledOrders: number;
}

export default function PanelStatsCards({ totalUsers, totalOrders, totalSales, canceledOrders }: PanelStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <DashboardStatCard
        title="Total Usuarios"
        value={totalUsers}
        icon={<HiOutlineUsers />}
        color="blue"
        trend={{ value: "0.00%", label: "Último mes", type: "up" }}
      />
      <DashboardStatCard
        title="Total de Ordenes"
        value={totalOrders}
        icon={<HiOutlineShoppingBag />}
        color="indigo"
        trend={{ value: "0.00%", label: "Mes seleccionado", type: "up" }}
      />
      <DashboardStatCard
        title="Total de Ventas"
        value={`${totalSales.toFixed(2)} USD`}
        icon={<HiOutlineCurrencyDollar />}
        color="blue"
        trend={{ value: "0.00%", label: "Mes seleccionado", type: "up" }}
      />
      <DashboardStatCard
        title="Total Canceladas"
        value={canceledOrders}
        icon={<HiOutlineXCircle />}
        color="rose"
        trend={{ value: "0.00%", label: "Mes seleccionado", type: "down" }}
      />
    </div>
  );
}
