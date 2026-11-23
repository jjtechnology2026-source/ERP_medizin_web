"use client";

import { useState } from "react";
import Link from "next/link";
import { HiOutlineChevronRight, HiOutlineLogout } from "react-icons/hi";
import { cn } from "@/modules/core/utils/ui";
import { ConfirmationDialog } from "@/components/shared/modals/ConfirmationDialog";
import { CurrencySwitch } from "@/components/ui/navbar/NavbarComponents";
import { MENU_ITEMS, filterMenuByPermits } from "@/components/ui/sidebar/menuConstants";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { usePermissions } from "@/modules/core/hooks/usePermissions";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { buildMoreHubSections, canRenderLogout } from "./mobileMenu";

const rowClass =
  "flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";

/**
 * `/mas` — the hub that replaced the mobile drawer for everything low frequency.
 *
 * It lists every destination the agent can see, grouped exactly like
 * `MENU_ITEMS` (headers included), plus the `mobileOnly` items the desktop
 * sidebar hides and the currency switch that left the mobile navbar. Rows are
 * 56px tall (S3) and nothing hides behind a hover (S5).
 */
export default function MobileMoreHub() {
  const { permits, isAdmin } = usePermissions();
  const profile = useAuthStore((state) => state.profile);
  const { logout } = useAuth();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  // Same filter as the sidebar. This page only exists in the mobile shell, so
  // `mobileOnly` items are kept instead of filtered out.
  const visibleMenu = filterMenuByPermits(MENU_ITEMS, permits, isAdmin || !profile);
  const sections = buildMoreHubSections(visibleMenu);
  const showLogout = canRenderLogout(visibleMenu);

  const confirmLogout = async () => {
    setIsLogoutDialogOpen(false);
    await logout();
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 lg:px-8 lg:py-8">
      <h1 className="px-1 text-lg font-black tracking-tight text-slate-800">Más</h1>

      <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
          Moneda
        </h2>
        <CurrencySwitch layout="stacked" />
      </section>

      {sections.map((section, index) => (
        <section
          key={`${section.title ?? "principal"}-${index}`}
          className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm"
        >
          {section.title && (
            <h2 className="px-2 pb-1 pt-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
              {section.title}
            </h2>
          )}
          <ul className="flex flex-col divide-y divide-slate-50">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={rowClass}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">
                    {item.name}
                  </span>
                  <HiOutlineChevronRight size={18} className="shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {showLogout && (
        <section className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setIsLogoutDialogOpen(true)}
            className={cn(rowClass, "text-rose-500 hover:bg-rose-50")}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
              <HiOutlineLogout size={22} />
            </span>
            <span className="flex-1 text-sm font-black">Cerrar sesión</span>
          </button>
        </section>
      )}

      <ConfirmationDialog
        isOpen={isLogoutDialogOpen}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={confirmLogout}
        title="¿Cerrar sesión?"
        description="¿Estás seguro de que deseas salir de tu cuenta? Tendrás que iniciar sesión nuevamente para acceder."
        confirmLabel="Sí, salir"
        variant="danger"
      />
    </div>
  );
}
