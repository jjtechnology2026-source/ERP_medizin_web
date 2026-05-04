import { useState, useEffect } from "react";
import api from "@/modules/core/api/client";

export function useOrders(idGroup: string, idPharmacy: string) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    id_group: idGroup,
    id_pharmacy: idPharmacy,
    date_start: "",
    date_end: "",
    type_sale: "",
    status: "",
  });

  // Keep id_group and id_pharmacy updated if they change from props
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      id_group: idGroup,
      id_pharmacy: idPharmacy
    }));
  }, [idGroup, idPharmacy]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        id_group: filters.id_group,
        id_pharmacy: filters.id_pharmacy,
        page: page.toString(),
        limit: "20",
        ...(filters.date_start && { "date.start": new Date(filters.date_start).toISOString() }),
        ...(filters.date_end && { "date.end": new Date(filters.date_end).toISOString() }),
        ...(filters.type_sale && { type_sale: filters.type_sale }),
        ...(filters.status && { status: filters.status }),
      });

      const { data } = await api.get(`/admin/Orders/SearchOrders?${params}`);
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, filters]);

  return { orders, loading, setFilters, filters, setPage, page, refresh: fetchOrders };
}
