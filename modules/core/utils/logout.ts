/**
 * clearAllStores
 *
 * Utilidad para limpiar TODOS los estados de Zustand y asegurar un cierre
 * de sesión impecable. Invocar antes de signOut().
 */
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useProductsStore } from "@/modules/products/store/products.store";

export const clearAllStores = () => {
  // Limpia el store de auth (pero conserva medicinesCatalog para que sobreviva al logout)
  const savedCatalog = useAuthStore.getState().medicinesCatalog;
  useAuthStore.getState().clearAuth();
  useAuthStore.getState().setMedicinesCatalog(savedCatalog);

  // Conserva products-storage para que cambios de precios sobrevivan al logout
  try {
    localStorage.removeItem("startedSession");
  } catch (error) {
    console.warn("No se pudo limpiar localStorage", error);
  }
};