"use client";

import { useMemo } from "react";
import OrdersPage from "./components/OrderListTable";
import OrderStatsCards from "./components/OrderStatsCards";
import { OrderService } from "./services/OrderService";
import { useOrders } from "./hooks/useOrders"; // Ajusta la ruta a donde guardes el hook
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export default function OrdersFeature() {
  const { profile } = useAuthStore();

  const { orders, loading, filters, setFilters, total, refresh, fetchNextPage, hasNextPage } = useOrders(profile?.id_group || "", profile?.pharmacyId || "");

  // `orders` is the flattened list of already-fetched infinite-query pages, so the cards
  // describe the loaded window, not the whole history. We compute them from that same
  // in-memory list (never from `/api/orders/stats`) so the counters are exactly consistent
  // with the rows below them. `total` (the server's full count) is intentionally not used
  // for the bucket cards: it would make them look like global totals they are not. The
  // cards' own "Órdenes Cargadas" label states what it counts.
  const stats = useMemo(() => OrderService.calculateStats(orders), [orders]);

  return (
    <div className="flex flex-col gap-8 p-3 min-h-full">
      <OrderStatsCards stats={stats} loading={loading} />
      <OrdersPage orders={orders} loading={loading} filters={filters} setFilters={setFilters} onRefresh={refresh} total={total} fetchNextPage={fetchNextPage} hasNextPage={hasNextPage} />
    </div>
  );
}
