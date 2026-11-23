import type { ReactElement } from "react";
import {
  HiOutlineCash,
  HiOutlineClipboardList,
  HiOutlineCube,
  HiOutlineReceiptRefund,
  HiOutlineViewGrid,
} from "react-icons/hi";
import type { MenuItem } from "@/components/ui/sidebar/menuConstants";

const TAB_ICON_SIZE = 22;

/** The "Más" hub: everything the bottom bar does not carry. */
export const MORE_HUB_HREF = "/mas";

/**
 * Bottom bar destinations, in order (spec S2).
 *
 * Labels are 1–2 words because they share the width of a phone with four
 * siblings; the icon and the `permit` are taken from `MENU_ITEMS` so the bar
 * cannot drift from the sidebar's permission model.
 */
interface TabConfig {
  label: string;
  href: string;
  /** Used when `MENU_ITEMS` has no entry for this href (the /mas hub). */
  fallbackIcon: ReactElement;
  /** Rendered even when the permit filter hides every other destination. */
  alwaysVisible?: boolean;
}

const MOBILE_TABS: TabConfig[] = [
  {
    label: "Caja",
    href: "/caja-ventas",
    fallbackIcon: <HiOutlineCash size={TAB_ICON_SIZE} />,
  },
  {
    label: "Productos",
    href: "/productos",
    fallbackIcon: <HiOutlineCube size={TAB_ICON_SIZE} />,
  },
  {
    label: "Pedidos",
    href: "/registro-ordenes",
    fallbackIcon: <HiOutlineClipboardList size={TAB_ICON_SIZE} />,
  },
  {
    label: "Facturas",
    href: "/facturas",
    fallbackIcon: <HiOutlineReceiptRefund size={TAB_ICON_SIZE} />,
  },
  {
    label: "Más",
    href: MORE_HUB_HREF,
    fallbackIcon: <HiOutlineViewGrid size={TAB_ICON_SIZE} />,
    alwaysVisible: true,
  },
];

export interface MobileTabDestination {
  label: string;
  href: string;
  icon: ReactElement;
}

/** Parent items followed by their children, recursively. */
export const flattenMenu = (items: MenuItem[]): MenuItem[] =>
  items.flatMap((item) => [
    item,
    ...(item.children ? flattenMenu(item.children) : []),
  ]);

/**
 * Resolves the bar destinations against an already permit-filtered menu.
 *
 * A destination the agent cannot access is not rendered at all: the bar
 * reflows with the ones that are, and "Más" always closes the row.
 */
export const resolveVisibleTabDestinations = (
  visibleMenu: MenuItem[],
): MobileTabDestination[] => {
  const byHref = new Map<string, MenuItem>();
  for (const item of flattenMenu(visibleMenu)) {
    if (item.href === "#" || byHref.has(item.href)) continue;
    byHref.set(item.href, item);
  }

  return MOBILE_TABS.flatMap((tab) => {
    const menuItem = byHref.get(tab.href);
    if (!menuItem && !tab.alwaysVisible) return [];
    return [
      {
        label: tab.label,
        href: tab.href,
        icon: menuItem?.icon ?? tab.fallbackIcon,
      },
    ];
  });
};

export interface MoreHubSection {
  title: string | null;
  items: MenuItem[];
}

/**
 * Groups an already permit-filtered menu into the `/mas` hub sections,
 * following the header/item order of `MENU_ITEMS`.
 *
 * Items with children contribute the parent and its children (that is how the
 * sidebar exposes submenus). `href` duplicates — "Reportes" points to its own
 * child — and non-navigable rows (headers, `#`, logout) are dropped: the logout
 * row is rendered by the hub as its own action.
 */
export const buildMoreHubSections = (
  visibleMenu: MenuItem[],
): MoreHubSection[] => {
  const sections: MoreHubSection[] = [];
  const seen = new Set<string>();
  let current: MoreHubSection = { title: null, items: [] };

  const push = (item: MenuItem) => {
    if (item.isHeader || item.isFooter || item.href === "#") return;
    if (seen.has(item.href)) return;
    seen.add(item.href);
    current.items.push(item);
  };

  for (const item of visibleMenu) {
    if (item.isHeader) {
      if (current.items.length) sections.push(current);
      current = { title: item.name, items: [] };
      continue;
    }

    push(item);
    for (const child of item.children ?? []) push(child);
  }

  if (current.items.length) sections.push(current);
  return sections;
};

/** The sidebar's "Cerrar sesión" row, which has no route. */
export const canRenderLogout = (visibleMenu: MenuItem[]): boolean =>
  visibleMenu.some((item) => item.isFooter);
