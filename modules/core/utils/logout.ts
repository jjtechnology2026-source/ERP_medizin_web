/**
 * clearAllStores
 *
 * Utilidad para limpiar TODOS los estados de Zustand y asegurar un cierre
 * de sesión impecable. Invocar antes de signOut().
 */
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useProductsStore } from "@/modules/products/store/products.store";

export const clearAllStores = () => {
  // Limpia el store de auth
  useAuthStore.getState().setMedicinesCatalog([]);
  useAuthStore.getState().clearAuth();

  // Limpia el store de productos (inventario, catálogo, filtros)
  // useProductsStore.getState().clearStorage();

  // Limpia localStorage persistido de productos
  try {
    localStorage.removeItem("products-storage");
    localStorage.removeItem("startedSession");
  } catch (error) {
    console.warn("No se pudo limpiar localStorage", error);
  }
};