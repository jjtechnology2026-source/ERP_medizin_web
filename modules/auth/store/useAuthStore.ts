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
  isHydrated: boolean;
  syncWithSession: (user: any) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      profile: null,
      isHydrated: false,
      syncWithSession: (user) => {
        if (JSON.stringify(get().profile) !== JSON.stringify(user)) {
          set({ profile: user });
        }
      },
      clearAuth: () => set({ profile: null }),
    }),
    {
      name: "auth-storage",
      // Corregido: Accedemos al set del closure o usamos el método de la instancia
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ isHydrated: true });
      },
    }
  )
);