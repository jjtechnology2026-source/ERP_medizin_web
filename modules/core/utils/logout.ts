/**
 * clearAllStores
 *
 * Utilidad para limpiar TODOS los estados de Zustand y asegurar un cierre
 * de sesión impecable. Invocar antes de signOut().
 */
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export const clearAllStores = () => {
  // Ejecuta la limpieza de cada store individualmente
  useAuthStore.getState().clearAuth();

  // Opcional: Solo si son manejadas llaves manuales fuera de Zustand
  try {
    localStorage.removeItem("startedSession");
  } catch (error) {
    console.warn("No se pudo limpiar startedSession en localStorage", error);
  }
};