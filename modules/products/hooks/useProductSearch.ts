import { useState, useEffect, useMemo, useCallback } from "react";
import { Medication } from "@/modules/products/types/products.types";

interface UseProductSearchOptions {
  inventory: Medication[];
  pageSize?: number;
  onlyInStock?: boolean;
}

export function useProductSearch({
  inventory,
  pageSize = 15,
  onlyInStock = true,
}: UseProductSearchOptions) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery]);

  const filtered = useMemo(() => {
    let source = inventory;
    if (onlyInStock) {
      source = source.filter((m) => m.stock > 0);
    }

    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return source;

    const exactBarcode = source.find((m) => m.barCode === debouncedQuery);
    if (exactBarcode) return [exactBarcode];

    return source
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.activeIngredient.toLowerCase().includes(q) ||
          m.brand.toLowerCase().includes(q) ||
          m.barCode.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aStarts =
          a.activeIngredient.toLowerCase().startsWith(q) ? 0
          : a.name.toLowerCase().startsWith(q) ? 1
          : 2;
        const bStarts =
          b.activeIngredient.toLowerCase().startsWith(q) ? 0
          : b.name.toLowerCase().startsWith(q) ? 1
          : 2;
        return aStarts - bStarts;
      });
  }, [inventory, debouncedQuery, onlyInStock]);

  const results = useMemo(
    () => filtered.slice(0, (page + 1) * pageSize),
    [filtered, page, pageSize]
  );

  const hasMore = results.length < filtered.length;

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setPage(0);
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    results,
    hasMore,
    loadMore,
    totalCount: filtered.length,
    reset,
  };
}
