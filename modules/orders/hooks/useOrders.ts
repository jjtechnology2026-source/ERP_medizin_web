import { useState, useEffect, useCallback } from "react";
import api from "@/modules/core/api/client";

export interface SearchOrdersResponse {
  orders: any[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

export function useOrders(idGroup: string, idPharmacy: string) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
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
    const cleanParams: Record<string, string> = { limit: "20" };

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

  /**
   * Fetch first page — replaces current orders array.
   * Called on mount and when filters change.
   */
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(buildParams(null));
      const response = await api.get<SearchOrdersResponse>(
        `/admin/Orders/SearchOrders?${params}`
      );

      const data = response.data;
      setOrders(data.orders ?? []);
      setNextCursor(data.next_cursor ?? null);
      setHasMore(data.has_more ?? false);
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error("Error fetching orders", error);
      setOrders([]);
      setNextCursor(null);
      setHasMore(false);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, buildParams]);

  /**
   * Load next page — appends to existing orders array.
   * Only called via "Load More" UI button.
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) return;

    setLoading(true);
    try {
      const params = new URLSearchParams(buildParams(nextCursor));
      const response = await api.get<SearchOrdersResponse>(
        `/admin/Orders/SearchOrders?${params}`
      );

      const data = response.data;
      setOrders(prev => [...prev, ...(data.orders ?? [])]);
      setNextCursor(data.next_cursor ?? null);
      setHasMore(data.has_more ?? false);
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error("Error loading more orders", error);
    } finally {
      setLoading(false);
    }
  }, [hasMore, nextCursor, filters, buildParams]);

  // Fetch first page on mount and when filters change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    setFilters,
    filters,
    loadMore,
    hasMore,
    total,
    refresh: fetchOrders,
  };
}