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

interface AuthState {
  profile: UserProfile | null;
  isHydrated: boolean;
  syncWithSession: (user: any) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    profile: null,
    isHydrated: true,
    syncWithSession: (user) => {
      if (JSON.stringify(get().profile) !== JSON.stringify(user)) {
        set({ profile: user });
      }
    },
    clearAuth: () => {
      try { localStorage.removeItem("auth-storage"); } catch (e) {}
      set({ profile: null });
    },
  })
);
