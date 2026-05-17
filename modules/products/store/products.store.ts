import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Medication, StockFilter } from "@/modules/products/types/products.types";
import { productsService } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

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
  deleteMedicine: (barCode: string) => Promise<void>;
  decrementStock: (items: { barCode: string; quantity: number }[]) => void;
  applyInventoryUpdate: (updates: { barCode: string; stock: number }[]) => void;
  getFilteredInventory: () => Medication[];
  getLowStockCount: () => number;
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

      fetchInventory: async (force?: boolean) => {
        const { inventory, isInitialLoad } = get();
        if (!force && !isInitialLoad && inventory.length > 0) return;

        const localCatalog = useAuthStore.getState().medicinesCatalog || [];

        if (isInitialLoad && inventory.length === 0 && localCatalog.length > 0) {
          set({ inventory: localCatalog.map(cleanImage), isLoading: true });
        } else {
          set({ isLoading: true });
        }

        try {
          const apiInventory = await productsService.getInventory();
          const inventoryMap = new Map<string, any>();
          get().inventory.forEach((item: any) => {
            if (item.barCode) inventoryMap.set(item.barCode, item);
          });
          apiInventory.forEach((item: any) => {
            if (item.barCode) inventoryMap.set(item.barCode, cleanImage(item));
          });
          const merged = Array.from(inventoryMap.values());
          if (merged.length > 0) set({ inventory: merged });
        } catch {
          // API is optional — persisted inventory survives reloads
        }
        set({ isLoading: false, isInitialLoad: false });
      },

      fetchCatalog: async () => {
        set({ isLoading: true, error: null });
        try {
          const catalog = await productsService.getCatalog();
          set({ catalog, isLoading: false });
        } catch {
          set({ isLoading: false, error: "Error al cargar catálogo" });
        }
      },

      setFilter: (filter) => set({ filter }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setEditMode: (editMode) => set({ editMode }),

      setCurrentMedicine: (currentMedicine) => set({ currentMedicine }),

      saveMedicine: async (medicine) => {
        const { editMode, inventory } = get();
        const localCopy = { ...medicine };
        try {
          if (editMode) {
            await productsService.upsertProducts([localCopy]);
          } else {
            await productsService.createProduct(localCopy);
          }
        } catch {
          // API is best-effort
        }
        if (editMode) {
          set({
            inventory: inventory.map((m) =>
              m.barCode === medicine.barCode ? medicine : m
            ),
          });
        } else {
          set({ inventory: [...inventory.filter(m => m.barCode !== medicine.barCode), medicine] });
        }
        return true;
      },

      deleteMedicine: async (barCode) => {
        const { inventory } = get();
        set({ inventory: inventory.filter((m) => m.barCode !== barCode) });
      },

      decrementStock: (items) => {
        const { inventory } = get();
        const updated = inventory.map((med) => {
          const item = items.find((i) => i.barCode === med.barCode);
          if (item) {
            return { ...med, stock: Math.max(0, med.stock - item.quantity) };
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
          filtered = filtered.filter((m) => m.stock <= (m.minimum ?? 0));
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
        return get().inventory.filter((m) => m.stock <= (m.minimum ?? 0)).length;
      },
    }),
    {
      name: "products-storage",
      partialize: (state) => ({
        inventory: state.inventory,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.inventory.length > 0) {
          state.isInitialLoad = false;
          state.isLoading = false;
          setTimeout(() => state.fetchInventory(true), 500);
        }
      },
    }
  )
);

// Auto-sync when auth store's medicinesCatalog changes
if (typeof window !== "undefined") {
  useAuthStore.subscribe((state) => {
    const pState = useProductsStore.getState();
    if (state.medicinesCatalog?.length && pState.inventory.length === 0) {
      pState.fetchInventory(true);
    }
  });
}
