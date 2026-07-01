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
  lastPharmacyId: string | null;
  _fetchPromise: Promise<void> | null;
}

interface ProductsActions {
  fetchInventory: (force?: boolean) => Promise<void>;
  fetchCatalog: (force?: boolean) => Promise<void>;
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
      lastPharmacyId: null,
      _fetchPromise: null,

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
          lastPharmacyId: null,
        });
        try {
          localStorage.removeItem("products-storage");
        } catch (e) {
          // noop
        }
      },

      // ponytail: shared promise so concurrent fetchInventory calls share the same request
      _fetchPromise: null as Promise<void> | null,

      fetchInventory: async (force = false) => {
        const { isInitialLoad, inventory, lastPharmacyId, _fetchPromise } = get();
        if (!force && !isInitialLoad && inventory.length > 0) return;

        // ponytail: deduplicate concurrent calls
        if (_fetchPromise) return _fetchPromise;

        const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
        if (!pharmacyId) {
          if (inventory.length === 0) set({ isLoading: true });
          return;
        }

        const pharmacyChanged = lastPharmacyId !== pharmacyId;

        if (inventory.length === 0 || pharmacyChanged) set({ isLoading: true });
        set({ error: null });

        const promise = (async () => {
          try {
            const localInventory = pharmacyChanged ? [] : [...inventory];

            const allMeds: Medication[] = [];
            let cursor: string | undefined;
            let hasMore = true;
            let retries = 0;
            const maxRetries = 3;

            while (hasMore) {
              const page = await productsService.getCursorInventory(pharmacyId, cursor, 200);

              if (page.total > 0 && page.medications.length === 0 && retries < maxRetries) {
                retries++;
                continue;
              }
              retries = 0;

              allMeds.push(...page.medications);

              set({
                inventory: [...allMeds],
                isLoading: true,
                isInitialLoad: false,
              });

              cursor = page.next_cursor ?? undefined;
              hasMore = page.has_more && !!page.next_cursor;
            }

            const localMap = new Map(localInventory.map(m => [m.barCode, m]));
            const merged = allMeds.map((api: Medication) => {
              const local = localMap.get(api.barCode);
              if (local) {
                localMap.delete(api.barCode);
                return {
                  ...api,
                  stock: (local.stock ?? 0) > 0 ? local.stock : api.stock,
                  quantity: (local.quantity ?? 0) > 0 ? local.quantity : api.quantity,
                  price: (local.price ?? 0) > 0 ? local.price : api.price,
                };
              }
              return api;
            });
            for (const [, local] of localMap) {
              merged.push(local);
            }

            set({ inventory: merged, isLoading: false, isInitialLoad: false, lastPharmacyId: pharmacyId });
          } catch (e: any) {
            if (inventory.length === 0) {
              const msg = "Error al cargar inventario";
              set({ error: msg, isLoading: false, isInitialLoad: false });
            } else {
              set({ isLoading: false });
            }
          } finally {
            set({ _fetchPromise: null });
          }
        })();

        set({ _fetchPromise: promise });
        return promise;
      },

      addToInventory: (medications: Medication[]) => {
        const { inventory } = get();
        const map = new Map(inventory.map(m => [m.barCode, m]));
        medications.forEach(m => { if (m.barCode) map.set(m.barCode, m); });
        const merged = Array.from(map.values());
        set({ inventory: merged });
      },

      fetchCatalog: async (force?: boolean) => {
        const { catalog } = get();
        if (!force && catalog.length > 0) return;
        set({ isLoading: true, error: null });
        try {
          const allCatalog: Medication[] = [];
          let cursor: string | undefined;
          let pageCount = 0;
          for (let i = 0; i < 10; i++) {
            const page = await productsService.getCatalog(cursor, 5000);
            allCatalog.push(...page.medications);
            pageCount++;
            cursor = page.next_cursor ?? undefined;
            set({ catalog: [...allCatalog], isLoading: true });
            if (!cursor || page.medications.length === 0) break;
          }
          console.log(
            "[fetchCatalog] Loaded",
            allCatalog.length,
            "medications in",
            pageCount,
            "page(s)",
            allCatalog.length > 0 ? `first: "${allCatalog[0]?.name}"` : "EMPTY"
          );
          set({ catalog: allCatalog, isLoading: false });
        } catch (e) {
          console.error("[fetchCatalog] Failed:", e);
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

        if (!existing) {
          try {
            await productsService.createProduct(medicine);
          } catch (error) {
            console.error("API error while saving medicine:", error);
            return false;
          }
        }

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
              await productsService.increaseInventory(pharmacyId, [{
                bar_code: medicine.barCode || "",
                stock: stockVal,
                price: medicine.price || 0,
                minimum: Number(medicine.minimum) || 0,
              }]);
            }
          }
        } catch (e) {
          console.error("[saveMedicine] increaseInventory error:", e);
        }

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
        lastPharmacyId: state.lastPharmacyId,
        // _fetchPromise is intentionally excluded — runtime-only
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.isInitialLoad = true;
        state.isLoading = true;
        setTimeout(() => state.fetchInventory(true), 500);
      },
    }
  )
);
