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

        const catalog = useAuthStore.getState().medicinesCatalog || [];
        if (catalog.length > 0 && !force) {
          set({ inventory: catalog.map(cleanImage), isLoading: false, isInitialLoad: false });
          return;
        }

        if (inventory.length === 0) set({ isLoading: true });
        set({ error: null });

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);
          const apiInventory = await productsService.getCatalog(controller.signal);
          clearTimeout(timeout);
          set({ inventory: apiInventory, isLoading: false, isInitialLoad: false });
          useAuthStore.getState().setMedicinesCatalog(apiInventory);
        } catch (e: any) {
          if (inventory.length === 0 && catalog.length === 0) {
            const msg = e?.name === "AbortError" ? "La consulta tardó demasiado. Intente de nuevo." : "Error al cargar inventario";
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
        const { inventory } = get();
        const exists = inventory.some((m) => m.barCode === medicine.barCode && m.barCode);
        try {
          await productsService.createProduct(medicine);
        } catch (error) {
          console.error("API error while saving medicine:", error);
          return false;
        }
        set({
          inventory: exists
            ? inventory.map((m) => m.barCode === medicine.barCode ? medicine : m)
            : [...inventory.filter(m => m.barCode !== medicine.barCode), medicine],
        });

        try {
          const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
          if (pharmacyId) {
            const quantityVal = typeof medicine.quantity === "number" ? medicine.quantity : (typeof medicine.stock === "number" ? medicine.stock : 0);
            const stockVal = typeof medicine.stock === "number" ? medicine.stock : (typeof medicine.quantity === "number" ? medicine.quantity : 0);
            
            const medProto = {
              barCode: medicine.barCode || "",
              name: medicine.name || "",
              price: medicine.price || 0,
              quantity: quantityVal > 0 ? quantityVal : stockVal,
              stock: stockVal,
              brand: medicine.brand || "",
              activeIngredient: medicine.activeIngredient || "",
              dosage: medicine.dosage || "",
              tablets: medicine.tablets || "",
              image: medicine.image || "",
              category: medicine.category || "",
              subcategory: medicine.subcategory || "",
              description: medicine.description || "",
              controlled: Boolean(medicine.controlled),
              vat: Number(medicine.vat) || 0,
              antibiotic: Boolean(medicine.antibiotic),
              minimum: Number(medicine.minimum) || 0,
            } as any;

            const dto: any = {
              idAgent: "web",
              idPharmacy: pharmacyId,
              medications: [medProto],
            };

            const buf = DtoUpdateMedications.encode(dto).finish();
            mqttServer.publish(MQTT_TOPICS.inventoryInsert(pharmacyId), buf).catch(() => {});
          }
        } catch (e) {
          // noop
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
          return;
        }
        set({ inventory: inventory.filter((m) => m.barCode !== barCode) });
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

        // Publish inventoryRemove with new stock values so other clients update
        try {
          const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
          if (pharmacyId) {
            const meds = updated
              .map((m) => ({ barCode: m.barCode, quantity: m.stock ?? 0 }))
              .filter((m) => items.some((it) => it.barCode === m.barCode));
            if (meds.length > 0) {
              const dto: any = { idAgent: "web", idPharmacy: pharmacyId, medications: meds };
              const buf = DtoUpdateMedications.encode(dto).finish();
              mqttServer.publish(MQTT_TOPICS.inventoryRemove(pharmacyId), buf).catch(() => {});
            }
          }
        } catch (e) {
          // noop
        }
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
      pState.fetchInventory(true);
    }
  });
}
