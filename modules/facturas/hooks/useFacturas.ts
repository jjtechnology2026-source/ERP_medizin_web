"use client";
import { useQuery } from "@tanstack/react-query";
import { facturasService } from "../api/facturas.service";
import type { FacturaFilters } from "../types";

export function useFacturas(filtros: FacturaFilters) {
  const query = useQuery({
    queryKey: ["facturas", filtros],
    queryFn: () => facturasService.list(filtros),
    enabled: !!filtros.pharmacy_id,
    staleTime: 30_000,
  });

  return {
    facturas: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
