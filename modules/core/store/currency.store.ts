import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "@/modules/core/api/client";

interface CurrencyState {
  isDollar: boolean;
  rate: number;
  manualRate: number;
  isLoading: boolean;
  error: string | null;
}

interface CurrencyActions {
  toggleCurrency: () => void;
  setCurrency: (val: boolean) => void;
  setManualRate: (rate: number) => void;
  fetchRate: () => Promise<void>;
  getEffectiveRate: () => number;
}

type CurrencyStore = CurrencyState & CurrencyActions;

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      isDollar: false,
      rate: 36.5,
      manualRate: 0,
      isLoading: false,
      error: null,

      toggleCurrency: () => set((s) => ({ isDollar: !s.isDollar })),

      setCurrency: (val: boolean) => set({ isDollar: val }),

      setManualRate: (rate: number) => set({ manualRate: rate }),

      fetchRate: async () => {
        set({ isLoading: true, error: null });
        try {
          const now = new Date();
          const formattedDate = `${now.getFullYear().toString().padStart(4, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

          const { data } = await api.request({
            url: "/Rate",
            method: "GET",
            data: { Moneda: "USD", Fechavalor: formattedDate },
            headers: { "Content-Type": "application/json" },
          });

          const rate = Number(data?.tipocambio) || 0;
          if (rate > 0) {
            set({ rate, isLoading: false });
          } else {
            set({ isLoading: false });
          }
        } catch {
          set({ isLoading: false, error: "Error al obtener tasa" });
        }
      },

      getEffectiveRate: () => {
        const { rate, manualRate } = get();
        if (manualRate > 0) return manualRate;
        if (rate > 0) return rate;
        return 36.5;
      },
    }),
    {
      name: "currency-storage",
      partialize: (state) => ({ isDollar: state.isDollar, manualRate: state.manualRate }),
    }
  )
);