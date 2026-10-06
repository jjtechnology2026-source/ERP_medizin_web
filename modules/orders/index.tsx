"use client";

import { useMemo } from "react";
import OrdersPage from "./components/OrderListTable";
import OrderStatsCards from "./components/OrderStatsCards";
import { OrderService } from "./services/OrderService";
import { useOrders } from "./hooks/useOrders"; // Ajusta la ruta a donde guardes el hook
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export default function OrdersFeature() {
  const { profile } = useAuthStore();

  const { orders, loading, filters, setFilters, total, totals, refresh, fetchNextPage, hasNextPage } = useOrders(profile?.id_group || "", profile?.pharmacyId || "");

  // The per-status counters come from the flattened list of already-fetched
  // infinite-query pages, so they describe the loaded window, not the whole
  // history; the cards' own labels state what they count. The sales card is
  // different: it renders the hook's scope `totals`, which the backend computes
  // over the whole filtered set (net of returns), so it no longer depends on how
  // many pages have loaded.
  const stats = useMemo(() => OrderService.calculateStats(orders), [orders]);

  return (
    <div className="flex flex-col gap-8 p-3 min-h-full">
      <OrderStatsCards stats={stats} scopeTotals={totals} loading={loading} />
      <OrdersPage orders={orders} loading={loading} filters={filters} setFilters={setFilters} onRefresh={refresh} total={total} fetchNextPage={fetchNextPage} hasNextPage={hasNextPage} />
    </div>
  );
}
