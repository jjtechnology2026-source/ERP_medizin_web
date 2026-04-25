import { useState, useEffect } from "react";
import api from "@/modules/core/api/client";

export function useOrders(idGroup: string, idPharmacy: string) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    dateStart: "",
    dateEnd: "",
    typeSale: "",
    status: ""
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        id_group: idGroup,
        id_pharmacy: idPharmacy,
        page: page.toString(),
        limit: "20",
        ...(filters.dateStart && { "date.start": new Date(filters.dateStart).toISOString() }),
        ...(filters.dateEnd && { "date.end": new Date(filters.dateEnd).toISOString() }),
        ...(filters.typeSale && { type_sale: filters.typeSale }),
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

  useEffect(() => { fetchOrders(); }, [page, filters]);

  return { orders, loading, setFilters, filters, setPage, page, refresh: fetchOrders };
}