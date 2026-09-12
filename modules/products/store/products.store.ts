import { create } from "zustand";
import { Medication, StockFilter } from "@/modules/products/types/products.types";
import { productsService } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { mqttServer } from "@/modules/core/mqtt/advanced-service";
import { MQTT_TOPICS } from "@/modules/core/mqtt/topics";
import { DtoUpdateMedications } from "@/proto/interfaces/dto";

// Tamaño de página del inventario. La carga es progresiva (scroll/prefetch),
// no se precarga todo el inventario en memoria ni en localStorage.
export const INVENTORY_PAGE_SIZE = 50;

interface ProductsState {
  /** Páginas ya cargadas (acumuladas), no el inventario completo. */
  inventory: Medication[];
  catalog: Medication[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isInitialLoad: boolean;
  hasMore: boolean;
  nextCursor: string | null;
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
  loadNextPage: () => Promise<void>;
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
  /** Carga una página (reset = primera/búsqueda; si no, siguiente). */
  // Dedup de la PRIMERA pagina (o busqueda/filtro) por clave: si dos componentes
  // disparan la misma carga a la vez, comparten una sola peticion.
  let firstPageInflight: { key: string; promise: Promise<void> } | null = null;

  const loadPage = async (reset: boolean) => {
    const { lastPharmacyId, nextCursor, searchQuery, filter, inventory, hasMore } = get();
    const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
    if (!pharmacyId) {
      set({ isLoading: false, isLoadingMore: false });
      return;
    }

    const pharmacyChanged = lastPharmacyId !== pharmacyId;
    const startFresh = reset || pharmacyChanged;

    if (startFresh) {
      const key = `${pharmacyId}|${searchQuery}|${filter}`;
      if (firstPageInflight && firstPageInflight.key === key) {
        return firstPageInflight.promise;
      }

      const promise = (async () => {
        set({ isLoading: true, isLoadingMore: false, error: null });
        try {
          const page = await productsService.getCursorInventory(pharmacyId, {
            limit: INVENTORY_PAGE_SIZE,
            query: searchQuery || undefined,
            lowStock: filter === "LOW",
          });
          set({
            inventory: page.medications,
            nextCursor: page.next_cursor,
            hasMore: page.has_more && !!page.next_cursor,
            isLoading: false,
            isLoadingMore: false,
            isInitialLoad: false,
            lastPharmacyId: pharmacyId,
            error: null,
          });
        } catch {
          set({
            isLoading: false,
            isLoadingMore: false,
            isInitialLoad: false,
            error: "Error al cargar inventario",
          });
        }
      })();

      firstPageInflight = { key, promise };
      try {
        await promise;
      } finally {
        if (firstPageInflight?.promise === promise) firstPageInflight = null;
      }
      return;
    }

    if (!hasMore || get().isLoadingMore) return;
    set({ isLoadingMore: true, error: null });
    try {
      const page = await productsService.getCursorInventory(pharmacyId, {
        cursor: nextCursor ?? undefined,
        limit: INVENTORY_PAGE_SIZE,
        query: searchQuery || undefined,
        lowStock: filter === "LOW",
      });
      const seen = new Set(inventory.map((m) => m.barCode));
      const merged = [
        ...inventory,
        ...page.medications.filter((m) => m.barCode && !seen.has(m.barCode)),
      ];
      set({
        inventory: merged,
        nextCursor: page.next_cursor,
        hasMore: page.has_more && !!page.next_cursor,
        isLoading: false,
        isLoadingMore: false,
        isInitialLoad: false,
        lastPharmacyId: pharmacyId,
        error: null,
      });
    } catch {
      set({ isLoading: false, isLoadingMore: false, error: "Error al cargar inventario" });
    }
  };

  return {
    inventory: [],
    catalog: [],
    isLoading: true,
    isLoadingMore: false,
    isInitialLoad: true,
    hasMore: false,
    nextCursor: null,
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
        isLoadingMore: false,
        isInitialLoad: true,
        hasMore: false,
        nextCursor: null,
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
      // Ya cargado para esta farmacia: no re-pedir (salvo force). Si hay una
      // carga en curso, devolver esa misma promesa (dedup entre componentes).
      if (!force && inventory.length > 0 && lastPharmacyId === pharmacyId) return;
      if (_fetchPromise) return _fetchPromise;

      const promise = (async () => {
        const pharmacyChanged = lastPharmacyId !== pharmacyId;
        set({
          inventory: force || pharmacyChanged ? [] : inventory,
          nextCursor: null,
          hasMore: true,
        });
        await loadPage(true);
        void get().refreshCounts();
      })();

      set({ _fetchPromise: promise });
      try {
        await promise;
      } finally {
        set({ _fetchPromise: null });
      }
    },

    loadNextPage: async () => {
      await loadPage(false);
    },

    searchInventory: async (text) => {
      set({ searchQuery: text });
      set({ inventory: [], nextCursor: null, hasMore: true });
      await loadPage(true);
    },

    refreshCounts: async (force = false) => {
      const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
      if (!pharmacyId) return;
      // Los conteos son caros (scan agregado): se calculan una vez por farmacia.
      if (!force && get()._countsPharmacyId === pharmacyId) return;
      try {
        const page = await productsService.getCursorInventory(pharmacyId, {
          limit: 1,
          resumen: true,
        });
        set({
          inventoryTotal: page.total ?? null,
          lowStockCount: page.lowStockCount ?? null,
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
        console.log(
          "[fetchCatalog] Loaded",
          allCatalog.length,
          "medications in",
          pageCount,
          "page(s)",
        );
        set({ catalog: allCatalog, isLoading: false });
      } catch (e) {
        console.error("[fetchCatalog] Failed:", e);
        set({ isLoading: false, error: "Error al cargar catálogo" });
      }
    },

    setFilter: (filter) => {
      set({ filter });
      set({ inventory: [], nextCursor: null, hasMore: true });
      void loadPage(true);
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
