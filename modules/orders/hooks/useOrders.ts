import { useInfiniteQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import api from "@/modules/core/api/client";

export interface SearchOrdersResponse {
  orders: any[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

const ITEMS_PER_PAGE = 20;

// ponytail: pre-fetch 2 pages ahead so navigation feels instant
const PREFETCH_PAGES = 2;

export function useOrders(idGroup: string, idPharmacy: string) {
  const [filters, setFilters] = useState({
    id_group: idGroup,
    id_pharmacy: idPharmacy,
    date_start: "",
    date_end: "",
    type_sale: "",
    status: "",
  });

  const prefetchRemaining = useRef(0);

  // Keep id_group and id_pharmacy updated if they change from props
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      id_group: idGroup,
      id_pharmacy: idPharmacy,
    }));
  }, [idGroup, idPharmacy]);

  const buildParams = useCallback(
    (cursor: string | null): Record<string, string> => {
      const cleanParams: Record<string, string> = {
        limit: String(ITEMS_PER_PAGE),
      };

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
    },
    [filters],
  );

  const query = useInfiniteQuery({
    queryKey: ["orders", filters],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams(buildParams(pageParam));
      const response = await api.get<SearchOrdersResponse>(
        `/admin/Orders/SearchOrders?${params}`,
      );
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    initialPageParam: null as string | null,
    staleTime: 30_000,
  });

  // Reset pre-fetch counter when filters change (triggers new query)
  useEffect(() => {
    prefetchRemaining.current = PREFETCH_PAGES;
  }, [filters]);

  // Pre-fetch next pages automatically when data arrives
  useEffect(() => {
    if (
      query.hasNextPage &&
      !query.isFetchingNextPage &&
      prefetchRemaining.current > 0
    ) {
      prefetchRemaining.current--;
      query.fetchNextPage();
    }
  }, [
    query.data?.pages.length,
    query.hasNextPage,
    query.isFetchingNextPage,
    query.fetchNextPage,
  ]);

  const orders = useMemo(
    () => query.data?.pages.flatMap((p) => p.orders ?? []) ?? [],
    [query.data],
  );

  const total = query.data?.pages[0]?.total ?? 0;

  return {
    orders,
    loading: query.isLoading,
    total,
    setFilters,
    filters,
    refresh: () => query.refetch(),
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
  };
}
