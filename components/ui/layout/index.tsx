"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/ui/sidebar";
import UserNavbar from "@/components/ui/navbar";
import MobileTabBar from "@/components/ui/mobile-nav";
import MobileSectionHeader from "@/components/ui/mobile-nav/MobileSectionHeader";
import LoadingOverlay from "@/modules/auth/components/LoadingOverlay";
import { useSession } from "next-auth/react";
import { resolveSectionName } from "@/components/ui/sidebar/menuConstants";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const { isHydrated, profile } = useAuthStore();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // 1. Protección de ruta y limpieza de sesión
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TEST_MODE === "true") return;

    if (status === "unauthenticated") {
      try {
        localStorage.removeItem("startedSession");
      } catch (error) {
        // En incógnito localStorage puede fallar, pero seguimos con la redirección.
      }
      router.replace("/");
    }
  }, [status, router]);

  // 2. Determinación dinámica del título de la página. La misma función alimenta
  // el header sticky de mobile, así que el nombre en pantalla y el `<title>`
  // nunca se contradicen.
  const activeSection = resolveSectionName(pathname);
  usePageTitle(activeSection);

  // 3. Gestión del estado de carga (Spinner)
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";
  const showSpinner = (!isHydrated || status === "loading" || (status === "authenticated" && !profile)) && !isTestMode;

  if (showSpinner) {
    return (
      <LoadingOverlay
        message="Cargando sistema..."
        // subtext="Estamos preparando tu panel Mara POS"
      />
    );
  }

  // 4. Bloqueo de renderizado si no hay sesión
  if (status === "unauthenticated" && !isTestMode) return null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#FBFCFE] font-sans text-slate-900">
      <UserNavbar
        isSidebarExpanded={isSidebarExpanded}
        onExpandToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop sidebar only. Below `lg` the drawer no longer exists: mobile
            navigates through the bottom bar and the /mas hub. The wrapper keeps
            every class that computed to the desktop layout before (S4). */}
        <div className="hidden lg:block fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-all duration-500 ease-in-out">
          <Sidebar isExpanded={isSidebarExpanded} onExpandToggle={() => setIsSidebarExpanded(!isSidebarExpanded)} />
        </div>

        <main className="mobile-shell-content flex-1 overflow-x-hidden overflow-y-auto">
          <MobileSectionHeader title={activeSection} />
          <div className="max-w-8xl mx-auto h-full p-0">{children}</div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}