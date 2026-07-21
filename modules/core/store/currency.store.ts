import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";

interface CurrencyState {
  isDollar: boolean;
  rate: number;
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
}

interface CurrencyActions {
  toggleCurrency: () => void;
  setCurrency: (val: boolean) => void;
  fetchRate: () => Promise<void>;
  getEffectiveRate: () => number;
}

type CurrencyStore = CurrencyState & CurrencyActions;

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      isDollar: false,
      rate: 36.5,
      initialized: false,
      isLoading: false,
      error: null,

      toggleCurrency: () => set((s) => ({ isDollar: !s.isDollar })),

      setCurrency: (val: boolean) => set({ isDollar: val }),

      fetchRate: async () => {
        set({ isLoading: true, error: null });
        try {
          const now = new Date();
          const formattedDate = `${now.getFullYear().toString().padStart(4, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

          const { data } = await axios.post("/api/proxy", {
            url: "/Rate",
            method: "GET",
            data: { Moneda: "USD", Fechavalor: formattedDate },
            headers: { "Content-Type": "application/json" },
          });

          const rate = Number(data?.tipocambio) || 0;
          if (rate > 0) {
            set({ rate, initialized: true, isLoading: false });
          } else {
            set({ initialized: true, isLoading: false });
          }
        } catch {
          set({ initialized: true, isLoading: false, error: "Error al obtener tasa" });
        }
      },

      getEffectiveRate: () => {
        const { rate } = get();
        return rate > 0 ? rate : 36.5;
      },
    }),
    {
      name: "currency-storage",
      partialize: (state) => ({
        isDollar: state.isDollar,
        rate: state.rate,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) return;
          state?.fetchRate();
        };
      },
    }
  )
);
