/**
 * clearAllStores
 *
 * Utilidad para limpiar TODOS los estados de Zustand y asegurar un cierre
 * de sesión impecable. Invocar antes de signOut().
 */
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export const clearAllStores = () => {
  useAuthStore.getState().clearAuth();

  try {
    localStorage.removeItem("products-storage");
    localStorage.removeItem("startedSession");
  } catch (error) {
    console.warn("No se pudo limpiar localStorage", error);
  }
};
