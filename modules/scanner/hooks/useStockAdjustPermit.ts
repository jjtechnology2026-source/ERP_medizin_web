"use client";

import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { hasStockAdjustPermit } from "../lib/stock-adjust-contract.ts";

/**
 * T4/S6: ¿esta sesión puede ajustar stock desde el escáner?
 *
 * Se lee `profile.permits` del auth store, igual que
 * `modules/core/hooks/usePermissions` (`profile?.permits`), pero sin reusar ese
 * hook: es un mapa de flags de contabilidad (crear, gestionar usuarios, tabs del
 * navbar) más dos `console.log` por render, y acá sólo hace falta un permiso con
 * comparación exacta -- la misma que exige el backend
 * (`tiene_permiso_de_ajuste`).
 *
 * El permiso es una **capacidad**: no agrega ni cambia ítems de menú.
 */
export function useStockAdjustPermit(): boolean {
  const permits = useAuthStore((state) => state.profile?.permits);
  return hasStockAdjustPermit(permits);
}
