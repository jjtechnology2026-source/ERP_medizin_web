import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import type { Order } from "@/modules/orders/types/orders";

export type SaleTypeCounts = {
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

export function usePanel() {
  const { profile } = useAuthStore();
  const [selectedMonthKey, setSelectedMonthKey] = useState("all");

  const ordersQuery = useMemo(() => {
    const params = new URLSearchParams({
      ...(profile?.id_group && { id_group: profile.id_group }),
      ...(profile?.pharmacyId && { id_pharmacy: profile.pharmacyId }),
      page: "1",
      limit: "1000",
    });

    return `/admin/Orders/SearchOrders?${params}`;
  }, [profile?.id_group, profile?.pharmacyId]);

  const { data: apiOrders = [] } = useApiQuery<Order[]>(["panel-stats", profile?.id_group, profile?.pharmacyId], ordersQuery, {
    enabled: !!profile?.id_group,
  });

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

  useEffect(() => {
    if (monthOptions.length === 0) return;
    setSelectedMonthKey((current) => (current === "all" ? monthOptions[0].key : current));
  }, [monthOptions]);

  const filteredOrders = useMemo(() => {
    if (selectedMonthKey === "all") return orders;
    return orders.filter((order) => getMonthKey(order.date) === selectedMonthKey);
  }, [orders, selectedMonthKey]);

  const totalSales = useMemo(() => filteredOrders.reduce((sum, order) => sum + (order.totalreal || 0), 0), [filteredOrders]);

  const totalOrders = useMemo(() => new Set(filteredOrders.map((order) => order.id)).size, [filteredOrders]);

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

  const topProducts = useMemo(() => {
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
  }, [filteredOrders]);

  return {
    profile,
    totalSales,
    totalOrders,
    totalUsers,
    canceledOrders,
    saleTypeCounts,
    topProducts,
    monthOptions,
    selectedMonthKey,
    setSelectedMonthKey,
  };
}
