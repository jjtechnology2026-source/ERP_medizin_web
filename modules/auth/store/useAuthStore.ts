import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  id_group?: string;
  permits: string[];
  [key: string]: any; 
}

interface AuthState {
  profile: UserProfile | null;
  medicinesCatalog: any[];
  isHydrated: boolean;
  syncWithSession: (user: any) => void;
  setMedicinesCatalog: (medicines: any[]) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      profile: null,
      medicinesCatalog: [],
      isHydrated: false,
      syncWithSession: (user) => {
        if (JSON.stringify(get().profile) !== JSON.stringify(user)) {
          set({ profile: user });
        }
      },
      setMedicinesCatalog: (medicines) => set({ medicinesCatalog: medicines }),
      clearAuth: () => set({ profile: null }),
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ isHydrated: true });
      },
    }
  )
);