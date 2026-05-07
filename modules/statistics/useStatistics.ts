"use client";
import { useMemo, useState } from "react";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { Order } from "@/modules/orders/types/orders";

export interface StatProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  controlled: boolean;
  cost: number;
  total: number;
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );

const aggregateProductStats = (orders: Order[]): StatProduct[] => {
  const map = new Map<string, StatProduct>();

  orders.forEach((order) => {
    order.medications?.forEach((med) => {
      const name = med.name?.trim() || "Sin nombre";
      const category = med.category?.trim() || "Sin categoría";
      const controlled = !!med.controlled;
      const price =
        typeof med.price === "number"
          ? med.price
          : parseFloat(String(med.price)) || 0;
      const quantity =
        typeof med.quantity === "number"
          ? med.quantity
          : parseFloat(String(med.quantity)) || 0;
      const total = price * quantity;
      const key = `${name}|${category}|${controlled}`;

      const existing = map.get(key);
      if (existing) {
        existing.quantity += quantity;
        existing.total += total;
      } else {
        map.set(key, {
          id: key,
          name,
          category,
          quantity,
          controlled,
          cost: price,
          total,
        });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

export function useStatistics(initialItemsPerPage = 20) {
  const { profile } = useAuthStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = initialItemsPerPage;

  const query = useMemo(() => {
    return new URLSearchParams({
      id_group: profile?.id_group || "",
      id_pharmacy: profile?.pharmacyId || "",
      ...(dateStart ? { "date.start": new Date(dateStart).toISOString() } : {}),
      ...(dateEnd ? { "date.end": new Date(dateEnd).toISOString() } : {}),
    }).toString();
  }, [profile?.id_group, profile?.pharmacyId, dateStart, dateEnd]);

  const { data: orders = [], isLoading } = useApiQuery<Order[]>(
    ["marketplace-stats", query],
    `/admin/Orders/SearchOrders?${query}`,
    {
      enabled:
        !!profile?.id_group || process.env.NEXT_PUBLIC_TEST_MODE === "true",
    },
  );

  const products = useMemo(() => aggregateProductStats(orders), [orders]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesCategory = !category || product.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((item) => item.category))).sort(),
    [products],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / itemsPerPage),
  );
  const currentItems = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const totalQuantity = filteredProducts.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const totalRevenue = filteredProducts.reduce(
    (sum, item) => sum + item.total,
    0,
  );

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setDateStart("");
    setDateEnd("");
    setCurrentPage(1);
  };

  return {
    state: { search, category, dateStart, dateEnd, currentPage, itemsPerPage },
    data: {
      products,
      filteredProducts,
      currentItems,
      categories,
      totalPages,
      totalQuantity,
      totalRevenue,
      isLoading,
    },
    actions: {
      setSearch,
      setCategory,
      setDateStart,
      setDateEnd,
      setCurrentPage,
      resetFilters,
    },
    utils: { formatCurrency },
  } as const;
}
