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

  // Query única — sin type_sale para traer TODAS las órdenes (locales + marketplace)
  const ordersQuery = useMemo(() => {
    const cleanParams: Record<string, string> = {
      limit: "500",
    };
    if (profile?.id_group && profile.id_group !== "undefined" && profile.id_group !== "null") {
      cleanParams.id_group = profile.id_group;
    }
    if (profile?.pharmacyId && profile.pharmacyId !== "undefined" && profile.pharmacyId !== "null") {
      cleanParams.id_pharmacy = profile.pharmacyId;
    }
    const params = new URLSearchParams(cleanParams);
    return `/admin/Orders/SearchOrders?${params}`;
  }, [profile?.id_group, profile?.pharmacyId]);

  const { data: orders = [], refetch, isLoading } = useApiQuery<Order[]>(
    ["panel-stats-v2", profile?.id_group, profile?.pharmacyId],
    ordersQuery || "",
    {
      enabled: !!ordersQuery,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Auto-refetch cuando el perfil esté disponible
  useEffect(() => {
    if (profile?.id_group) {
      refetch();
    }
  }, [profile?.id_group, profile?.pharmacyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthOptions = useMemo(() => {
    const monthKeys = new Set<string>();
    orders.forEach((order) => {
      const orderDate = order.date || (order as any).fecha;
      const monthKey = orderDate ? getMonthKey(orderDate) : "";
      if (monthKey) monthKeys.add(monthKey);
    });
    return Array.from(monthKeys)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ key, label: formatMonthLabel(key) }));
  }, [orders]);

  // Keep "all" as default to show all lifetime stats by default unless explicitly chosen otherwise
  useEffect(() => {
    if (monthOptions.length === 0) return;
    setSelectedMonthKey((current) => current || "all");
  }, [monthOptions]);

  const filteredOrders = useMemo(() => {
    if (selectedMonthKey === "all") return orders;
    return orders.filter((order) => {
      const orderDate = order.date || (order as any).fecha;
      return orderDate ? getMonthKey(orderDate) === selectedMonthKey : false;
    });
  }, [orders, selectedMonthKey]);

  const totalSales = useMemo(
    () => filteredOrders.reduce((sum, order) => {
      const val = order.totalreal !== undefined ? order.totalreal : (order as any).total_real;
      return sum + (Number(val) || 0);
    }, 0),
    [filteredOrders]
  );

  const totalOrders = useMemo(
    () => new Set(filteredOrders.map((order) => order.id)).size,
    [filteredOrders]
  );

  const totalUsers = useMemo(
    () =>
      new Set(
        filteredOrders.map(
          (order) => order.client?.id || order.client?.documento || order.client?.email
        )
      ).size,
    [filteredOrders]
  );

  const canceledOrders = filteredOrders.filter((order) => {
    const status = (order.saleStatus || (order as any).sale_status) as any;
    return status === "Cancelled" || status === "Canceled" || status === "cancelada" || status === "CANCELADA";
  }).length;

  const saleTypeCounts = useMemo<SaleTypeCounts>(() => {
    const counts: SaleTypeCounts = { delivery: 0, pickup: 0, local: 0 };
    filteredOrders.forEach((order) => {
      const type = (order.saleType || (order as any).sale_type)?.trim()?.toLowerCase();
      if (type === "delivery" || type === "marketplace") counts.delivery += 1;
      else if (type === "pick up" || type === "pickup") counts.pickup += 1;
      else if (type === "local") counts.local += 1;
    });
    return counts;
  }, [filteredOrders]);

  const topProducts = useMemo(() => {
    const productMap = new Map<string, { id: string; name: string; quantity: number }>();
    filteredOrders.forEach((order) => {
      const medications = order.medications || (order as any).medicines || [];
      medications.forEach((medication: any) => {
        const key = medication.name;
        if (!key) return;
        const qty = Number(medication.quantity) || 0;
        const existing = productMap.get(key);
        if (existing) {
          existing.quantity += qty;
        } else {
          productMap.set(key, {
            id: key,
            name: medication.name,
            quantity: qty,
          });
        }
      });
    });
    return Array.from(productMap.values())
      .sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 5);
  }, [filteredOrders]);

  const ordersByMonth = useMemo(() => {
    const map = new Map<string, { orders: number; sales: number }>();
    orders.forEach((order) => {
      const orderDate = order.date || (order as any).fecha;
      const mk = orderDate ? getMonthKey(orderDate) : "";
      if (!mk) return;
      const val = order.totalreal !== undefined ? order.totalreal : (order as any).total_real;
      const existing = map.get(mk) || { orders: 0, sales: 0 };
      existing.orders += 1;
      existing.sales += Number(val) || 0;
      map.set(mk, existing);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orders]);

  const trends = useMemo(() => {
    if (ordersByMonth.length < 2) return { salesGrowth: 0, ordersGrowth: 0, usersGrowth: 0 };
    const current = ordersByMonth[ordersByMonth.length - 1];
    const previous = ordersByMonth[ordersByMonth.length - 2];
    const salesGrowth = previous[1].sales > 0 ? ((current[1].sales - previous[1].sales) / previous[1].sales) * 100 : 0;
    const ordersGrowth = previous[1].orders > 0 ? ((current[1].orders - previous[1].orders) / previous[1].orders) * 100 : 0;
    return { salesGrowth, ordersGrowth, usersGrowth: 0 };
  }, [ordersByMonth]);

  const salesTrend = useMemo(() => {
    return ordersByMonth.map(([month, data]) => ({
      month: formatMonthLabel(month).split(" de ")[0],
      ventas: data.sales,
      ordenes: data.orders,
    }));
  }, [ordersByMonth]);

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
    isLoading,
    totalOrdersCount: orders.length,
    trends,
    salesTrend,
  };
}
