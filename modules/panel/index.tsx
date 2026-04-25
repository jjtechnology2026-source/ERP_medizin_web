"use client";
import { useEffect, useMemo, useState } from "react";
import { DashboardStatCard } from "./components/DashboardStatCard";
import { PromoCarousel } from "./components/PromoCarousel";
import { SalesTypeCard } from "./components/SalesTypeCard";
import { TopProductsCard } from "./components/TopProductsCard";
import { HiOutlineUsers, HiOutlineShoppingBag, HiOutlineCurrencyDollar, HiOutlineXCircle } from "react-icons/hi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import type { Order } from "@/modules/orders/types/orders";

type SaleTypeCounts = {
  delivery: number;
  pickup: number;
  local: number;
};

const getMonthKey = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("es-VE", { month: "long", year: "numeric" }).format(date);
};

export default function PanelFeature() {
  const { profile } = useAuthStore();

  const ordersQuery = useMemo(() => {
    const params = new URLSearchParams({
      ...(profile?.id_group && { id_group: profile.id_group }),
      ...(profile?.pharmacyId && { id_pharmacy: profile.pharmacyId }),
      page: "1",
      limit: "1000",
    });

    return `/admin/Orders/SearchOrders?${params}`;
  }, [profile?.id_group, profile?.pharmacyId]);

  const { data: apiOrders = [] } = useApiQuery<Order[]>(
    ["panel-stats", profile?.id_group, profile?.pharmacyId],
    ordersQuery,
    { enabled: !!profile?.id_group },
  );

  const orders: Order[] = apiOrders;

  const monthOptions = useMemo(() => {
    const monthKeys = new Set<string>();

    orders.forEach((order) => {
      const monthKey = getMonthKey(order.date);
      if (monthKey) {
        monthKeys.add(monthKey);
      }
    });

    return Array.from(monthKeys)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ key, label: formatMonthLabel(key) }));
  }, [orders]);

  const [selectedMonthKey, setSelectedMonthKey] = useState("all");

  useEffect(() => {
    if (monthOptions.length === 0) return;
    setSelectedMonthKey((current) => (current === "all" ? monthOptions[0].key : current));
  }, [monthOptions]);

  const filteredOrders = useMemo(() => {
    if (selectedMonthKey === "all") return orders;
    return orders.filter((order) => getMonthKey(order.date) === selectedMonthKey);
  }, [orders, selectedMonthKey]);

  const totalSales = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + (order.totalreal || 0), 0),
    [filteredOrders],
  );

  const totalOrders = useMemo(
    () => new Set(filteredOrders.map((order) => order.id)).size,
    [filteredOrders],
  );

  const totalUsers = useMemo(
    () => new Set(filteredOrders.map((order) => order.client?.id || order.client?.documento || order.client?.email)).size,
    [filteredOrders],
  );

  const canceledOrders = filteredOrders.filter((order) => order.saleStatus === "Cancelled").length;

  const saleTypeCounts = useMemo<SaleTypeCounts>(() => {
    const counts: SaleTypeCounts = { delivery: 0, pickup: 0, local: 0 };

    filteredOrders.forEach((order) => {
      const type = order.saleType?.trim()?.toLowerCase();
      if (type === "delivery") counts.delivery += 1;
      else if (type === "pick up" || type === "pickup") counts.pickup += 1;
      else if (type === "local") counts.local += 1;
    });

    return counts;
  }, [filteredOrders]);

  const topProducts = useMemo(
    () => {
      const productMap = new Map<string, { id: string; name: string; quantity: number }>();

      filteredOrders.forEach((order) => {
        order.medications?.forEach((medication) => {
          const key = medication.name;
          const label = medication.name;

          const existing = productMap.get(key);
          if (existing) {
            existing.quantity += medication.quantity;
          } else {
            productMap.set(key, {
              id: key,
              name: label,
              quantity: medication.quantity,
            });
          }
        });
      });

      return Array.from(productMap.values())
        .sort((a, b) => {
          if (b.quantity !== a.quantity) return b.quantity - a.quantity;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 3);
    },
    [filteredOrders],
  );

  return (
    <div className="flex flex-col gap-10 p-6 md:p-10 bg-[#FBFCFE] min-h-full">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Panel de control</h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
          Bienvenido de nuevo, <span className="text-blue-600">{profile?.name || "Administrador"}</span>
        </p>
      </header>

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

      <div className="w-full">
        <PromoCarousel />
      </div>

      <div className="rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 group">
        <img
          src="https://img.freepik.com/free-vector/clean-medical-background_53876-116875.jpg"
          alt="Banner publicitario"
          className="w-full h-45 object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
        <SalesTypeCard
          monthOptions={[{ key: "all", label: "Todos los meses" }, ...monthOptions]}
          selectedMonthKey={selectedMonthKey}
          onMonthChange={setSelectedMonthKey}
          counts={saleTypeCounts}
        />
        <TopProductsCard products={topProducts} />
      </div>

      <div className="h-4" />
    </div>
  );
}
