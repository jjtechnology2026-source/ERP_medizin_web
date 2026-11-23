"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/modules/core/utils/ui";
import { usePermissions } from "@/modules/core/hooks/usePermissions";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { MENU_ITEMS, filterMenuByPermits } from "@/components/ui/sidebar/menuConstants";
import { resolveVisibleTabDestinations } from "./mobileMenu";

const isActiveHref = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * Bottom tab bar of the mobile shell (specs S2, S3, S8).
 *
 * Exists only below `lg`: the desktop composition keeps the sidebar and never
 * shows a bottom bar (S4). Items are 56px tall (44px floor, S3), the active one
 * is announced with `aria-current="page"` plus a shape and a color change, and
 * the bar clears the iOS home indicator through `env(safe-area-inset-bottom)`.
 */
export default function MobileTabBar() {
  const pathname = usePathname();
  const { permits, isAdmin } = usePermissions();
  const profile = useAuthStore((state) => state.profile);

  // Same permit filtering as the sidebar. Without a profile (test mode /
  // bypass) nothing is restricted, otherwise the bar would come out empty.
  const visibleMenu = filterMenuByPermits(MENU_ITEMS, permits, isAdmin || !profile);
  const destinations = resolveVisibleTabDestinations(visibleMenu);

  return (
    <nav
      aria-label="Navegación principal"
      className="mobile-tabbar-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden"
    >
      <ul className="flex items-stretch">
        {destinations.map((destination) => {
          const active = isActiveHref(pathname, destination.href);

          return (
            <li key={destination.href} className="min-w-0 flex-1">
              <Link
                href={destination.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-1 pb-1.5 pt-2 text-[11px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                  active ? "font-black text-blue-600" : "font-bold text-slate-500",
                )}
              >
                {/* Shape marker, not color only (WCAG 1.4.1). */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-blue-600 transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-blue-50",
                  )}
                >
                  {destination.icon}
                </span>
                <span className="max-w-full truncate leading-none">
                  {destination.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
