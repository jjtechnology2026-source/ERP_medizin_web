"use client";

import { useState } from "react";
import OrdersPage from "./components/OrderListTable";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { Order } from "./types/orders"; 

export default function MarketplaceFeature() {
  const { profile } = useAuthStore();
  
  const [filters, setFilters] = useState({
    id_group: profile?.id_group || "",
    id_pharmacy: profile?.pharmacyId || "",
    date_start: "",
    date_end: "",
    type_sale: "",
    status: "", 
  });

  const query = new URLSearchParams({
    id_group: filters.id_group,
    id_pharmacy: filters.id_pharmacy,
    ...(filters.date_start && { "date.start": new Date(filters.date_start).toISOString() }),
    ...(filters.date_end && { "date.end": new Date(filters.date_end).toISOString() }),
    ...(filters.type_sale && { type_sale: filters.type_sale }),
  }).toString();

  const { data: orders = [], isLoading, error, refetch } = useApiQuery<Order[]>(
    ["marketplace-orders", filters], 
    `/admin/Orders/SearchOrders?${query}`,
    { enabled: !!filters.id_group }
  );

  console.log(JSON.stringify(orders, null, 2));

  return (  
    <div className="flex flex-col gap-8 p-3 min-h-full">
      <OrdersPage 
        orders={orders} 
        loading={isLoading}
        filters={filters}
        setFilters={setFilters}
        onRefresh={refetch}
      />
    </div>
  );
}