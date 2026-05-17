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
      const cleanParams: Record<string, string> = {
        page: page.toString(),
        limit: "20",
      };

      if (filters.id_group && filters.id_group !== "undefined") {
        cleanParams.id_group = filters.id_group;
      }
      if (filters.id_pharmacy && filters.id_pharmacy !== "undefined") {
        cleanParams.id_pharmacy = filters.id_pharmacy;
      }
      if (filters.date_start) {
        cleanParams["date.start"] = new Date(filters.date_start).toISOString();
      }
      if (filters.date_end) {
        cleanParams["date.end"] = new Date(filters.date_end).toISOString();
      }
      if (filters.type_sale) {
        cleanParams.type_sale = filters.type_sale;
      }
      if (filters.status) {
        cleanParams.status = filters.status;
      }

      const params = new URLSearchParams(cleanParams);
      const response = await api.get(`/admin/Orders/SearchOrders?${params}`);
      
      // Extract array safely from possible backend response wrapper keys
      const finalData = response.data?.result || response.data?.data || response.data;
      setOrders(Array.isArray(finalData) ? finalData : []);
    } catch (error) {
      console.error("Error fetching orders", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  console.log(JSON.stringify(orders, null, 2));

  useEffect(() => {
    fetchOrders();
  }, [page, filters]);

  return { orders, loading, setFilters, filters, setPage, page, refresh: fetchOrders };
}
