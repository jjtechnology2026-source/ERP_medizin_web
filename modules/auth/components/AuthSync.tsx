"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export default function AuthSync() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  const syncWithSession = useAuthStore((state: any) => state.syncWithSession);
  const clearAuth = useAuthStore((state: any) => state.clearAuth);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      syncWithSession(session.user);
      return;
    }

    if (status === "unauthenticated") {
      const isLoginPage = typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "/login");
      if (isLoginPage) {
        clearAuth();
      }
    }
  }, [mounted, session, status, syncWithSession, clearAuth]);

  return null;
}