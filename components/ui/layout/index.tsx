"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/ui/sidebar";
import UserNavbar from "@/components/ui/navbar";
import LoadingOverlay from "@/modules/auth/components/LoadingOverlay";
import { useSession } from "next-auth/react";
import { MENU_ITEMS } from "@/components/ui/sidebar/menuConstants";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const { isHydrated, profile } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  // 2. Determinación dinámica del título de la página
  const getActiveSectionName = () => {
    for (const item of MENU_ITEMS) {
      if (item.href === pathname) return item.name;
      if (item.children) {
        const activeChild = item.children.find((child: any) => child.href === pathname);
        if (activeChild) return activeChild.name;
      }
    }
    return "Panel General";
  };

  const activeSection = getActiveSectionName();
  usePageTitle(activeSection);

  // 3. Gestión del estado de carga (Spinner)
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";
  const showSpinner = (status === "loading" || (status === "authenticated" && !profile)) && !isTestMode;

  if (showSpinner) {
    return (
      <LoadingOverlay
        message="Cargando sistema..."
        // subtext="Estamos preparando tu panel Medizin"
      />
    );
  }

  // 4. Bloqueo de renderizado si no hay sesión
  if (status === "unauthenticated" && !isTestMode) return null;

  return (
    <div className="h-screen flex flex-col bg-[#FBFCFE] overflow-hidden font-sans text-slate-900">
      <UserNavbar 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        isSidebarOpen={isSidebarOpen}
        isSidebarExpanded={isSidebarExpanded}
        onExpandToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`
          fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0
          transition-all duration-500 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}>
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isExpanded={isSidebarExpanded} onExpandToggle={() => setIsSidebarExpanded(!isSidebarExpanded)} />
        </div>

        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" 
            onClick={() => setIsSidebarOpen(false)} 
          />
        )}

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="max-w-8xl mx-auto h-full p-0">{children}</div>
        </main>
      </div>
    </div>
  );
}