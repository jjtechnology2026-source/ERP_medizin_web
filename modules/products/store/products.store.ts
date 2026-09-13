import { create } from "zustand";
import { Medication, StockFilter } from "@/modules/products/types/products.types";
import { productsService } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { mqttServer } from "@/modules/core/mqtt/advanced-service";
import { MQTT_TOPICS } from "@/modules/core/mqtt/topics";
import { DtoUpdateMedications } from "@/proto/interfaces/dto";

// Tamaño de página del inventario. Paginación clásica (page-based): se pide una
// página a la vez con offset; NO se precarga todo el inventario.
export const INVENTORY_PAGE_SIZE = 10;

interface ProductsState {
  /** Solo la página actual del inventario. */
  inventory: Medication[];
  catalog: Medication[];
  isLoading: boolean;
  isInitialLoad: boolean;
  hasMore: boolean;
  page: number;
  inventoryTotal: number | null;
  lowStockCount: number | null;
  error: string | null;
  filter: StockFilter;
  searchQuery: string;
  editMode: boolean;
  currentMedicine: Partial<Medication> | null;
  lastPharmacyId: string | null;
  _fetchPromise: Promise<void> | null;
  _countsPharmacyId: string | null;
  recentMutations: Record<string, number>;
}

interface ProductsActions {
  fetchInventory: (force?: boolean) => Promise<void>;
  setPage: (page: number) => Promise<void>;
  searchInventory: (text: string) => Promise<void>;
  refreshCounts: (force?: boolean) => Promise<void>;
  findInventoryItem: (barCode: string) => Promise<Medication | null>;
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
  getLowStockCount: () => number;
  clearStorage: () => void;
}

type ProductsStore = ProductsState & ProductsActions;

const initialFilters = {
  filter: "GENERAL" as StockFilter,
  searchQuery: "",
  editMode: false,
  currentMedicine: null,
};

export const useProductsStore = create<ProductsStore>()((set, get) => {
  // Dedup de la carga de una pagina por clave: si dos componentes piden la misma
  // pagina a la vez, comparten una sola peticion.
  let pageInflight: { key: string; promise: Promise<void> } | null = null;

  /** Carga una pagina concreta (page-based, offset). */
  const loadPage = async (page: number) => {
    const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
    if (!pharmacyId) {
      set({ isLoading: false });
      return;
    }
    const { searchQuery, filter } = get();
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * INVENTORY_PAGE_SIZE;

    const key = `${pharmacyId}|${searchQuery}|${filter}|${safePage}`;
    if (pageInflight && pageInflight.key === key) return pageInflight.promise;

    const promise = (async () => {
      set({ isLoading: true, error: null });
      try {
        const res = await productsService.getCursorInventory(pharmacyId, {
          offset,
          limit: INVENTORY_PAGE_SIZE,
          query: searchQuery || undefined,
          lowStock: filter === "LOW",
        });
        set({
          inventory: res.medications,
          hasMore: res.has_more,
          page: safePage,
          isLoading: false,
          isInitialLoad: false,
          lastPharmacyId: pharmacyId,
          error: null,
        });
      } catch {
        set({
          inventory: [],
          hasMore: false,
          isLoading: false,
          isInitialLoad: false,
          error: "Error al cargar inventario",
        });
      }
    })();

    pageInflight = { key, promise };
    try {
      await promise;
    } finally {
      if (pageInflight?.promise === promise) pageInflight = null;
    }
  };

  return {
    inventory: [],
    catalog: [],
    isLoading: true,
    isInitialLoad: true,
    hasMore: false,
    page: 1,
    inventoryTotal: null,
    lowStockCount: null,
    error: null,
    ...initialFilters,
    lastPharmacyId: null,
    _fetchPromise: null,
    _countsPharmacyId: null,
    recentMutations: {},

    clearStorage: () => {
      set({
        inventory: [],
        catalog: [],
        isLoading: false,
        isInitialLoad: true,
        hasMore: false,
        page: 1,
        inventoryTotal: null,
        lowStockCount: null,
        error: null,
        ...initialFilters,
        lastPharmacyId: null,
        _countsPharmacyId: null,
      });
    },

    fetchInventory: async (force = false) => {
      const { inventory, lastPharmacyId, _fetchPromise } = get();
      const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
      if (!pharmacyId) {
        if (inventory.length === 0) set({ isLoading: true });
        return;
      }
      if (!force && inventory.length > 0 && lastPharmacyId === pharmacyId && get().page === 1) return;
      if (_fetchPromise) return _fetchPromise;

      const promise = (async () => {
        await loadPage(1);
        void get().refreshCounts();
      })();

      set({ _fetchPromise: promise });
      try {
        await promise;
      } finally {
        set({ _fetchPromise: null });
      }
    },

    setPage: async (page) => {
      await loadPage(page);
    },

    searchInventory: async (text) => {
      set({ searchQuery: text });
      await loadPage(1);
    },

    refreshCounts: async (force = false) => {
      const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
      if (!pharmacyId) return;
      // Los conteos son caros (scan agregado): se calculan una vez por farmacia.
      if (!force && get()._countsPharmacyId === pharmacyId) return;
      try {
        const res = await productsService.getCursorInventory(pharmacyId, {
          limit: 1,
          resumen: true,
        });
        set({
          inventoryTotal: res.total ?? null,
          lowStockCount: res.lowStockCount ?? null,
          _countsPharmacyId: pharmacyId,
        });
      } catch {
        // conteos son best-effort
      }
    },

    findInventoryItem: async (barCode) => {
      const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
      if (!pharmacyId || !barCode) return null;
      try {
        const page = await productsService.getCursorInventory(pharmacyId, {
          query: barCode,
          limit: 10,
        });
        return (
          page.medications.find((m) => m.barCode === barCode) ??
          page.medications[0] ??
          null
        );
      } catch {
        return null;
      }
    },

    addToInventory: (medications) => {
      const { inventory } = get();
      const map = new Map(inventory.map((m) => [m.barCode, m]));
      medications.forEach((m) => {
        if (m.barCode) map.set(m.barCode, m);
      });
      set({ inventory: Array.from(map.values()) });
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
        console.log("[fetchCatalog] Loaded", allCatalog.length, "medications in", pageCount, "page(s)");
        set({ catalog: allCatalog, isLoading: false });
      } catch (e) {
        console.error("[fetchCatalog] Failed:", e);
        set({ isLoading: false, error: "Error al cargar catálogo" });
      }
    },

    setFilter: (filter) => {
      set({ filter });
      void loadPage(1);
    },

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
      } else {
        try {
          await productsService.createProduct({
            ...medicine,
            stock: existing.stock ?? 0,
            quantity: existing.quantity ?? 0,
          });
        } catch (error) {
          console.error("API error while updating medicine:", error);
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
        : [...inventory.filter((m) => m.barCode !== medicine.barCode), medicine];
      set({ inventory: updatedInventory });

      try {
        const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
        if (pharmacyId) {
          const stockVal = typeof medicine.stock === "number" ? medicine.stock : 0;
          const priceVal = medicine.price ?? 0;
          const minVal = Number(medicine.minimum) || 0;
          const discountVal = medicine.discount !== undefined ? Number(medicine.discount) : undefined;
          const changed =
            stockVal !== (existing?.stock ?? 0) ||
            priceVal !== (existing?.price ?? 0) ||
            minVal !== (existing?.minimum ?? 0) ||
            discountVal !== (existing?.discount ?? undefined);
          if (changed) {
            await productsService.increaseInventory(pharmacyId, [{
              bar_code: medicine.barCode || "",
              stock: stockVal,
              price: priceVal,
              minimum: minVal,
              ...(discountVal !== undefined ? { discount: discountVal } : {}),
              ...(medicine.basePrice !== undefined ? { base_price: medicine.basePrice } : {}),
              ...(medicine.profitPercentage !== undefined ? { profit_percentage: medicine.profitPercentage } : {}),
              ...(medicine.lote?.trim() && stockVal > 0 ? { lote: medicine.lote.trim() } : {}),
            }]);
          }
        }
      } catch (e) {
        console.error("[saveMedicine] increaseInventory error:", e);
      }

      void get().refreshCounts(true);
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
        const authState = useAuthStore.getState();
        const pharmacyId = authState.profile?.pharmacyId;
        if (pharmacyId) {
          const agentId = (authState.profile as any)?.id_agent || (authState.profile as any)?.agentId || "web";
          const dto: any = {
            idAgent: agentId,
            idPharmacy: pharmacyId,
            medications: [{ barCode, quantity: 0 }],
          };
          const buf = DtoUpdateMedications.encode(dto).finish();
          mqttServer.publish(MQTT_TOPICS.inventoryDecrease(pharmacyId), buf, agentId).catch(() => {});
        }
      } catch (e) {}

      void get().refreshCounts(true);
    },

    decrementStock: (items) => {
      const { inventory, recentMutations } = get();
      const now = Date.now();
      const updated = inventory.map((med) => {
        const item = items.find((i) => i.barCode === med.barCode);
        if (item) {
          recentMutations[med.barCode] = now;
          return { ...med, stock: Math.max(0, (med.stock ?? 0) - item.quantity) };
        }
        return med;
      });
      set({ inventory: updated, recentMutations: { ...recentMutations } });
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

    getLowStockCount: () => {
      const { lowStockCount } = get();
      return lowStockCount ?? 0;
    },
  };
});
