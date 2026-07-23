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

    const normalizeStr = (str: string | undefined | null) => {
      if (!str) return "";
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    const q = normalizeStr(debouncedQuery).trim();
    if (!q) return source;

    const exactBarcode = source.find((m) => m.barCode === debouncedQuery);
    if (exactBarcode) return [exactBarcode];

    return source
      .filter(
        (m) =>
          normalizeStr(m.name).includes(q) ||
          normalizeStr(m.activeIngredient).includes(q) ||
          normalizeStr(m.brand).includes(q) ||
          normalizeStr(m.barCode).includes(q)
      )
      .sort((a, b) => {
        const aStarts =
          normalizeStr(a.activeIngredient).startsWith(q) ? 0
          : normalizeStr(a.name).startsWith(q) ? 1
          : 2;
        const bStarts =
          normalizeStr(b.activeIngredient).startsWith(q) ? 0
          : normalizeStr(b.name).startsWith(q) ? 1
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
