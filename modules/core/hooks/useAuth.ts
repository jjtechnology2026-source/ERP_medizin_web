import { signIn, signOut, useSession } from "next-auth/react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useCallback } from "react";
import { clearAllStores } from "../utils/logout";

export const useAuth = () => {
  const { data: session, status } = useSession();
  const profile = useAuthStore((state: any) => state.profile);
  const syncWithSession = useAuthStore((state: any) => state.syncWithSession);

  const login = useCallback(async (credentials: any) => {
    const result = await signIn("credentials", {
      ...credentials,
      callbackUrl: "/panel",
      redirect: false,
    });

    if (result?.error) {
      let errorMessage = result.error;
      try {
        if (errorMessage.startsWith("{")) {
          const parsed = JSON.parse(errorMessage);
          errorMessage = parsed.message || errorMessage;
        }
      } catch (e) {}
      throw new Error(errorMessage);
    }

    return result;
  }, []);

  const logout = useCallback(async () => {
    clearAllStores();
    await signOut({ callbackUrl: "/" });
  }, []);

  return {
    session,
    user: session?.user,
    status,
    profile,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    login,
    logout,
    syncWithSession,
  };
};
