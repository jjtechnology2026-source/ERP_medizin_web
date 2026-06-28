import { useState, useEffect, useCallback } from "react";
import api from "@/modules/core/api/client";

export interface SearchOrdersResponse {
  orders: any[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

const ITEMS_PER_PAGE = 20;
const MAX_CURSOR_PAGES = 15; // cap to prevent runaway loops

export function useOrders(idGroup: string, idPharmacy: string) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
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

  const buildParams = useCallback((cursor: string | null): Record<string, string> => {
    const cleanParams: Record<string, string> = { limit: String(ITEMS_PER_PAGE) };

    if (cursor) {
      cleanParams.cursor = cursor;
    }
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

    return cleanParams;
  }, [filters]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const allOrders: any[] = [];
      let cursor: string | null = null;
      let hasMore = true;
      let pagesLoaded = 0;
      let firstPage = true;

      while (hasMore && pagesLoaded < MAX_CURSOR_PAGES) {
        const params: URLSearchParams = new URLSearchParams(buildParams(cursor));
        const response = await api.get<SearchOrdersResponse>(
          `/admin/Orders/SearchOrders?${params}`
        );

        const data = response.data;
        allOrders.push(...(data.orders ?? []));
        cursor = data.next_cursor ?? null;
        hasMore = data.has_more ?? false;
        setTotal(data.total ?? 0);
        pagesLoaded++;

        // Show first page immediately, load the rest in background
        if (firstPage) {
          setOrders([...allOrders]);
          setLoading(false);
          firstPage = false;
        }
      }

      // Update with all accumulated orders after background load finishes
      if (!firstPage) {
        setOrders(allOrders);
      }
    } catch (error) {
      console.error("Error fetching orders", error);
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, buildParams]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    setFilters,
    filters,
    total,
    refresh: fetchOrders,
  };
}