import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Medication, StockFilter } from "@/modules/products/types/products.types";
import { productsService } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { mqttServer } from "@/modules/core/mqtt/advanced-service";
import { MQTT_TOPICS } from "@/modules/core/mqtt/topics";
import { DtoUpdateMedications } from "@/proto/interfaces/dto";

interface ProductsState {
  inventory: Medication[];
  catalog: Medication[];
  isLoading: boolean;
  isInitialLoad: boolean;
  error: string | null;
  filter: StockFilter;
  searchQuery: string;
  editMode: boolean;
  currentMedicine: Partial<Medication> | null;
}

interface ProductsActions {
  fetchInventory: (force?: boolean) => Promise<void>;
  fetchCatalog: () => Promise<void>;
  setFilter: (filter: StockFilter) => void;
  setSearchQuery: (query: string) => void;
  setEditMode: (mode: boolean) => void;
  setCurrentMedicine: (med: Partial<Medication> | null) => void;
  saveMedicine: (medicine: Medication) => Promise<boolean>;
  addToInventory: (medications: Medication[]) => void;
  deleteMedicine: (barCode: string) => Promise<void>;
  decrementStock: (items: { barCode: string; quantity: number }[]) => void;
  applyInventoryUpdate: (updates: { barCode: string; stock: number }[]) => void;
  getFilteredInventory: () => Medication[];
  getLowStockCount: () => number;
  clearStorage: () => void;
}

type ProductsStore = ProductsState & ProductsActions;

const cleanImage = (item: any) => ({
  ...item,
  image: item.image && typeof item.image === "string" && item.image.startsWith("http") ? item.image : "",
  stock: item.stock !== undefined ? Number(item.stock) : (item.quantity !== undefined ? Number(item.quantity) : 0),
  quantity: item.quantity !== undefined ? Number(item.quantity) : (item.stock !== undefined ? Number(item.stock) : 0),
  price: Number(item.price) || 0,
});

export const useProductsStore = create<ProductsStore>()(
  persist(
    (set, get) => ({
      inventory: [],
      catalog: [],
      isLoading: true,
      isInitialLoad: true,
      error: null,
      filter: "GENERAL",
      searchQuery: "",
      editMode: false,
      currentMedicine: null,

      // Clear persisted products and reset state
      clearStorage: () => {
        set({
          inventory: [],
          catalog: [],
          isLoading: false,
          isInitialLoad: true,
          error: null,
          filter: "GENERAL",
          searchQuery: "",
          editMode: false,
          currentMedicine: null,
        });
        try {
          localStorage.removeItem("products-storage");
        } catch (e) {
          // noop
        }
      },

      fetchInventory: async (force = false) => {
        const { isInitialLoad, inventory } = get();
        if (!force && !isInitialLoad && inventory.length > 0) return;

        const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
        if (!pharmacyId) {
          // ponytail: no hacer nada — MqttInventoryProvider reintentará cuando el perfil esté listo
          if (inventory.length === 0) set({ isLoading: true });
          return;
        }

        if (inventory.length === 0) set({ isLoading: true });
        set({ error: null });

        try {
          // Cargar con cursor paginado desde SurrealDB
          const allMeds: Medication[] = [];
          let cursor: string | undefined;
          let hasMore = true;

          while (hasMore) {
            const page = await productsService.getCursorInventory(pharmacyId, cursor, 200);
            allMeds.push(...page.medications);
            cursor = page.next_cursor ?? undefined;
            hasMore = page.has_more && !!page.next_cursor;
          }

          const localMap = new Map(inventory.map(m => [m.barCode, m]));
          const merged = allMeds.map((api: Medication) => {
            const local = localMap.get(api.barCode);
            if (local) {
              return {
                ...api,
                stock: (local.stock ?? 0) > 0 ? local.stock : api.stock,
                quantity: (local.quantity ?? 0) > 0 ? local.quantity : api.quantity,
                price: (local.price ?? 0) > 0 ? local.price : api.price,
              };
            }
            return api;
          });

          set({ inventory: merged, isLoading: false, isInitialLoad: false });
          useAuthStore.getState().setMedicinesCatalog(merged);
        } catch (e: any) {
          if (inventory.length === 0) {
            const msg = "Error al cargar inventario";
            set({ error: msg, isLoading: false, isInitialLoad: false });
          } else {
            set({ isLoading: false });
          }
        }
      },

      addToInventory: (medications: Medication[]) => {
        const { inventory } = get();
        const map = new Map(inventory.map(m => [m.barCode, m]));
        medications.forEach(m => { if (m.barCode) map.set(m.barCode, m); });
        const merged = Array.from(map.values());
        set({ inventory: merged });
        useAuthStore.getState().setMedicinesCatalog(merged);
      },

      fetchCatalog: async () => {
        set({ isLoading: true, error: null });
        try {
          // ponytail: cursor pagination from SurrealDB — max 10 pages of 200
          const allCatalog: Medication[] = [];
          let cursor: string | undefined;
          let pages = 0;
          const maxPages = 10;
          while (pages < maxPages) {
            const page = await productsService.getCatalog(cursor, 200);
            allCatalog.push(...page.medications);
            cursor = page.next_cursor ?? undefined;
            pages++;
            if (!cursor || page.medications.length === 0) break;
          }
          set({ catalog: allCatalog, isLoading: false });
        } catch {
          set({ isLoading: false, error: "Error al cargar catálogo" });
        }
      },

      setFilter: (filter) => set({ filter }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setEditMode: (editMode) => set({ editMode }),

      setCurrentMedicine: (currentMedicine) => set({ currentMedicine }),

      saveMedicine: async (medicine) => {
        const { inventory } = get();
        const existing = inventory.find((m) => m.barCode === medicine.barCode && m.barCode);

        // ponytail: solo crear en catalogo si es producto NUEVO (evita duplicados)
        if (!existing) {
          try {
            await productsService.createProduct(medicine);
          } catch (error) {
            console.error("API error while saving medicine:", error);
            return false;
          }
        }

        // ponytail: add stock instead of replacing — backend uses quantity as increment
        const updatedInventory = existing
          ? inventory.map((m) => {
              if (m.barCode === medicine.barCode) {
                return {
                  ...m,
                  ...medicine,
                  stock: (m.stock ?? 0) + (medicine.stock ?? 0),
                  quantity: (m.quantity ?? 0) + (medicine.quantity ?? 0),
                };
              }
              return m;
            })
          : [...inventory.filter(m => m.barCode !== medicine.barCode), medicine];
        set({ inventory: updatedInventory });

        try {
          const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
          if (pharmacyId) {
            const stockVal = typeof medicine.stock === "number" ? medicine.stock : 0;
            if (stockVal > 0) {
              productsService.increaseInventory(pharmacyId, [{
                bar_code: medicine.barCode || "",
                stock: stockVal,
                price: medicine.price || 0,
                minimum: Number(medicine.minimum) || 0,
              }]).catch((e) => {
                console.error("[saveMedicine] HTTP increaseInventory failed:", e);
              });
            }
          }
        } catch (e) {
          console.error("[saveMedicine] increaseInventory error:", e);
        }

        useAuthStore.getState().setMedicinesCatalog(get().inventory);
        return true;
      },

      deleteMedicine: async (barCode) => {
        const { inventory } = get();
        try {
          await productsService.deleteProduct(barCode);
        } catch (error) {
          console.error("API error while deleting medicine:", error);
        }
        const updated = inventory.filter((m) => m.barCode !== barCode);
        set({ inventory: updated });

        // Publish MQTT to remove from SurrealDB inventory
        try {
          const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
          if (pharmacyId) {
            const dto: any = {
              idAgent: "web",
              idPharmacy: pharmacyId,
              medications: [{ barCode, quantity: 0 }],
            };
            const buf = DtoUpdateMedications.encode(dto).finish();
            mqttServer.publish(MQTT_TOPICS.inventoryRemove(pharmacyId), buf).catch(() => {});
          }
        } catch (e) {}

        useAuthStore.getState().setMedicinesCatalog(updated);
      },

      decrementStock: (items) => {
        const { inventory } = get();
        const updated = inventory.map((med) => {
          const item = items.find((i) => i.barCode === med.barCode);
          if (item) {
            return { ...med, stock: Math.max(0, (med.stock ?? 0) - item.quantity) };
          }
          return med;
        });
        set({ inventory: updated });
      },


      applyInventoryUpdate: (updates) => {
        const { inventory } = get();
        const updated = inventory.map((med) => {
          const update = updates.find((u) => u.barCode === med.barCode);
          if (update) {
            return { ...med, stock: update.stock };
          }
          return med;
        });
        set({ inventory: updated });
      },

      getFilteredInventory: () => {
        const { inventory, filter, searchQuery } = get();
        const q = searchQuery.toLowerCase().trim();
        let filtered = [...inventory];

        if (filter === "LOW") {
          filtered = filtered.filter((m) => (m.stock ?? 0) <= (m.minimum ?? 0));
        }

        if (q) {
          filtered = filtered.filter(
            (m) =>
              (m.name || "").toLowerCase().includes(q) ||
              (m.barCode || "").toLowerCase().includes(q) ||
              (m.activeIngredient || "").toLowerCase().includes(q) ||
              (m.brand || "").toLowerCase().includes(q)
          );
        }

        return filtered;
      },

      getLowStockCount: () => {
        return get().inventory.filter((m) => (m.stock ?? 0) <= (m.minimum ?? 0)).length;
      },
    }),
    {
      name: "products-storage",
      partialize: (state) => ({
        inventory: state.inventory,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // ponytail: siempre refrescar del servidor — cache localStorage puede estar stale
        state.isInitialLoad = true;
        state.isLoading = true;
        setTimeout(() => state.fetchInventory(true), 500);
      },
    }
  )
);

// Auto-sync when auth store's medicinesCatalog changes
if (typeof window !== "undefined") {
  useAuthStore.subscribe((state) => {
    const pState = useProductsStore.getState();
    if (state.medicinesCatalog?.length && pState.inventory.length === 0) {
      useProductsStore.setState({
        inventory: state.medicinesCatalog.map(cleanImage),
        isLoading: false,
        isInitialLoad: false,
      });
    }
  });
}
