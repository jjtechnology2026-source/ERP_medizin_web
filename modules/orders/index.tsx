"use client";

import OrdersPage from "./components/OrderListTable";
import { useOrders } from "./hooks/useOrders"; // Ajusta la ruta a donde guardes el hook
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export default function OrdersFeature() {
  const { profile } = useAuthStore();

  const { orders, loading, filters, setFilters, setPage, page, refresh } = useOrders(profile?.id_group || "", profile?.pharmacyId || "");

  return (
    <div className="flex flex-col gap-8 p-3 min-h-full">
      <OrdersPage orders={orders} loading={loading} filters={filters} setFilters={setFilters} onRefresh={refresh} />
    </div>
  );
}
