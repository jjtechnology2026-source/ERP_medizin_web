import { create } from "zustand";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  id_group?: string;
  permits: string[];
  [key: string]: any; 
}

const loadMedicinesFromLocalStorage = (): any[] => {
  try {
    const data = localStorage.getItem("medicines-catalog");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

interface AuthState {
  profile: UserProfile | null;
  medicinesCatalog: any[];
  isHydrated: boolean;
  syncWithSession: (user: any) => void;
  setMedicinesCatalog: (medicines: any[]) => void;
  clearAuth: () => void;
}

// ponytail: no persistence — tab close = re-login. Simpler than storage edge cases.
export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    profile: null,
    medicinesCatalog: typeof window !== "undefined" ? loadMedicinesFromLocalStorage() : [],
    isHydrated: true,
    syncWithSession: (user) => {
      if (JSON.stringify(get().profile) !== JSON.stringify(user)) {
        set({ profile: user });
      }
      const lsMedicines = loadMedicinesFromLocalStorage();
      if (lsMedicines.length) {
        set({ medicinesCatalog: lsMedicines });
      }
    },
    setMedicinesCatalog: (medicines) => set({ medicinesCatalog: medicines }),
    clearAuth: () => {
      try { localStorage.removeItem("medicines-catalog"); } catch (e) {}
      try { localStorage.removeItem("auth-storage"); } catch (e) {}
      set({ profile: null, medicinesCatalog: [] });
    },
  })
);
