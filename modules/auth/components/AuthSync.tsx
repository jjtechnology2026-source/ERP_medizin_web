"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export default function AuthSync() {
  const { data: session, status } = useSession();
  
  const syncWithSession = useAuthStore((state: any) => state.syncWithSession);
  const clearAuth = useAuthStore((state: any) => state.clearAuth);
  const isHydrated = useAuthStore((state: any) => state.isHydrated);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      syncWithSession(session.user);
      return;
    }

    if (status === "unauthenticated" && isHydrated) {
      const isLoginPage = typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "/login");
      if (isLoginPage) {
        clearAuth();
      }
    }
  }, [session, status, isHydrated, syncWithSession, clearAuth]);

  return null;
}