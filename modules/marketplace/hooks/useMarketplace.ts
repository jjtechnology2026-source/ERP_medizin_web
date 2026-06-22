import { useEffect, useState, useMemo, useRef } from "react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useMqttOrders } from "../providers/MqttOrdersProvider";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import { Order } from "@/modules/orders/types/orders";

export function useMarketplaceOrders(initialSelectedOrderId?: string) {
  const { profile } = useAuthStore();
  const { queuedOrders, mqttConnected, acceptOrder, rejectOrder, focusOrder } = useMqttOrders();

  const [activeTab, setActiveTab] = useState<"incoming" | "completed">("incoming");

  const [filters, setFilters] = useState({
    status: "",
    date_start: "",
    date_end: "",
    search: "",
    minPrice: "",
    maxPrice: "",
    sortOrder: "desc",
  });

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [initialOrderHandled, setInitialOrderHandled] = useState(false);

  // --- API Data Fetching ---
  const pendingQueryParams = useMemo(() => {
    const pharmId = profile?.pharmacyId;
    if (!pharmId) return "";
    return `?pharmacy_id=${encodeURIComponent(pharmId)}`;
  }, [profile?.pharmacyId]);

  const {
    data: pendingRedisOrders = [],
    refetch: refetchPending,
  } = useApiQuery<any[]>(
    ["marketplace-pending-redis", profile?.pharmacyId || ""],
    `/admin/Orders/marketplace/pending${pendingQueryParams}`,
    {
      enabled: !!profile?.pharmacyId,
      staleTime: 5000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }
  );

  const queryParams = useMemo(() => {
    if (!profile?.id_group) return "";

    return new URLSearchParams({
      id_group: profile.id_group,
      id_pharmacy: profile.pharmacyId || "",
      ...(filters.status && { status: filters.status }),
      ...(filters.date_start && { "date.start": new Date(filters.date_start).toISOString() }),
      ...(filters.date_end && { "date.end": new Date(filters.date_end).toISOString() }),
    }).toString();
  }, [profile, filters.status, filters.date_start, filters.date_end]);

  const {
    data: response,
    isLoading,
    refetch,
  } = useApiQuery<{ orders: Order[] }>(
    ["marketplace-orders-list", queryParams],
    `/admin/Orders/SearchOrders?${queryParams}`,
    {
      enabled: !!profile?.id_group && !!queryParams,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
  const orders = response?.orders ?? [];

  // Auto-fetch cuando el perfil esté disponible
  useEffect(() => {
    if (profile?.id_group) {
      refetch();
    }
  }, [profile?.id_group]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refetch cada 30 segundos para mantener datos frescos
  useEffect(() => {
    if (!profile?.id_group) return;
    const interval = setInterval(() => refetch(), 30000);
    return () => clearInterval(interval);
  }, [profile?.id_group, refetch]);

  // Refetch al reconectar MQTT
  const prevMqtt = useRef(mqttConnected);
  useEffect(() => {
    if (mqttConnected && !prevMqtt.current) {
      refetch();
      refetchPending();
    }
    prevMqtt.current = mqttConnected;
  }, [mqttConnected, refetch, refetchPending]);

  // Merge Redis pending orders with MQTT live queue
  const allIncomingOrders = useMemo(() => {
    const mqttIds = new Set(queuedOrders.map((o: any) => o.orderId));
    const redisOnly = (pendingRedisOrders || [])
      .filter((o: any) => !mqttIds.has(o.order_id || o.orderId))
      .map((o: any) => ({
        orderId: o.order_id || o.orderId,
        clientName: o.client_info?.name || "Cliente",
        clientAddress: o.client_info?.address || "",
        clientPhone: o.client_info?.phone || "",
        clientIdNumber: o.client_info?.cedula || "",
        items: (o.medicines || []).map((m: any) => ({
          name: m.name,
          barcode: m.medicine_id,
          quantity: m.quantity,
          price: 0,
        })),
        createdAt: undefined,
        saleType: "Marketplace",
      }));
    return [...queuedOrders, ...redisOnly];
  }, [queuedOrders, pendingRedisOrders]);

  // --- Filtrado Local Interactivo ---
  const filteredOrders = useMemo(() => {
    const list = orders.filter((o) => {
      const status = (o.saleStatus || (o as any).sale_status || "") as any;
      const price = o.totalreal !== undefined ? o.totalreal : (o as any).total_real;
      const medications = o.medications || (o as any).medicines || [];

      // Only show PENDING, NEW, ACCEPTED, or PENDIENTE/NUEVA/ACEPTADA orders
      const s = String(status).toUpperCase();
      if (s !== "PENDING" && s !== "PENDIENTE" && s !== "NEW" && s !== "NUEVA" && s !== "ACCEPTED" && s !== "ACEPTADA" && s !== "") {
        return false;
      }

      // 2. Buscador
      if (filters.search) {
        const term = filters.search.toLowerCase();
        const idMatches = (o.id || "").toLowerCase().includes(term);
        const clientMatches =
          (o.client?.name || "").toLowerCase().includes(term) ||
          (o.client?.documento || "").toLowerCase().includes(term) ||
          (o.client?.email || "").toLowerCase().includes(term);
        const medicineMatches = medications.some(
          (m: any) =>
            (m.name || "").toLowerCase().includes(term) ||
            (m.brand || "").toLowerCase().includes(term) ||
            (m.activeIngredient || "").toLowerCase().includes(term)
        );

        if (!idMatches && !clientMatches && !medicineMatches) return false;
      }

      // 3. Rango de Precio
      if (filters.minPrice) {
        const minVal = parseFloat(filters.minPrice);
        if (!isNaN(minVal) && (Number(price) || 0) < minVal) return false;
      }
      if (filters.maxPrice) {
        const maxVal = parseFloat(filters.maxPrice);
        if (!isNaN(maxVal) && (Number(price) || 0) > maxVal) return false;
      }

      return true;
    });

    // Sort by date!
    return list.sort((a, b) => {
      const dateA = a.date || (a as any).fecha || "";
      const dateB = b.date || (b as any).fecha || "";
      const timeA = new Date(dateA).getTime();
      const timeB = new Date(dateB).getTime();
      return filters.sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
  }, [orders, filters]);

  // --- Estadísticas ---
  const stats = useMemo(() => {
    const pendingOrders = orders.filter((o) => {
      const status = (o.saleStatus || (o as any).sale_status || "") as any;
      return status === "Pending" || status === "PENDIENTE" || status === "pendiente";
    });
    const completedOrders = orders.filter((o) => {
      const status = (o.saleStatus || (o as any).sale_status || "") as any;
      return status === "Completed" || status === "COMPLETADA" || status === "completada" ||
             status === "Cancelled" || status === "CANCELADA" || status === "cancelada" ||
             status === "Canceled" || status === "CANCELED" || status === "canceled";
    });
    return {
      total: orders.length,
      pending: pendingOrders.length,
      completed: completedOrders.length,
    };
  }, [orders]);

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
    orders: filteredOrders,
    unfilteredOrdersCount: orders.length,
    isLoading,
    refetch,
    stats,
    activeTab,
    setActiveTab,
    filters,
    setFilters,
    selectedOrder,
    setSelectedOrder,
    mqttConnected,
    queuedOrders: allIncomingOrders,
    handleAccept,
    handleReject,
    handleViewRealtimeOrder,
  };
}
