import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useMqttOrders } from "../providers/MqttOrdersProvider";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import { Order } from "@/modules/orders/types/orders";

export function useMarketplaceOrders(initialSelectedOrderId?: string) {
  const { profile } = useAuthStore();
  const { queuedOrders, mqttConnected, acceptOrder, rejectOrder, focusOrder } = useMqttOrders();

  const [filters, setFilters] = useState({
    status: "",
    date_start: "",
    date_end: "",
  });

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [initialOrderHandled, setInitialOrderHandled] = useState(false);

  // --- API Data Fetching ---
  const queryParams = useMemo(() => {
    if (!profile?.id_group) return "";

    return new URLSearchParams({
      id_group: profile.id_group,
      id_pharmacy: profile.pharmacyId || "",
      type_sale: "Marketplace",
      ...(filters.status && { status: filters.status }),
      ...(filters.date_start && { "date.start": new Date(filters.date_start).toISOString() }),
      ...(filters.date_end && { "date.end": new Date(filters.date_end).toISOString() }),
    }).toString();
  }, [profile, filters]);

  const {
    data: orders = [],
    isLoading,
    refetch,
  } = useApiQuery<Order[]>(["marketplace-orders-list", filters], `/admin/Orders/SearchOrders?${queryParams}`, { enabled: !!profile?.id_group });

  // --- Estadísticas ---
  const stats = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.saleStatus !== "Completed").length,
      completed: orders.filter((o) => o.saleStatus === "Completed").length,
    }),
    [orders],
  );

  useEffect(() => {
    if (!initialSelectedOrderId || initialOrderHandled) return;
    if (orders.length === 0) return;

    const foundOrder = orders.find(
      (order) => order.id === initialSelectedOrderId || order.id.endsWith(initialSelectedOrderId),
    );

    if (foundOrder) {
      setSelectedOrder(foundOrder);
    }

    setInitialOrderHandled(true);
  }, [initialSelectedOrderId, initialOrderHandled, orders]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Handlers ---
  const handleAccept = async (orderId?: string) => {
    const published = await acceptOrder(orderId);
    if (published) {
      refetch();
    }
  };

  const handleReject = async (orderId?: string) => {
    await rejectOrder(orderId);
  };

  const handleViewRealtimeOrder = (orderId: string) => {
    focusOrder(orderId);
  };

  return {
    orders,
    isLoading,
    refetch,
    stats,
    filters,
    setFilters,
    selectedOrder,
    setSelectedOrder,
    mqttConnected,
    queuedOrders,
    handleAccept,
    handleReject,
    handleViewRealtimeOrder,
  };
}
