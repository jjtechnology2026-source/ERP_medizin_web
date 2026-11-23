import {
  HiOutlineTemplate,
  HiOutlineCash,
  HiOutlineShoppingCart,
  HiOutlineClipboardList,
  HiOutlineCube,
  HiOutlineQrcode,
  HiOutlineChatAlt2,
  HiOutlinePresentationChartLine,
  HiOutlineDocumentReport,
  HiOutlineReceiptRefund,
  HiOutlineCog,
  HiOutlineLogout,
  HiOutlineArchive,
} from "react-icons/hi";
import { ReactElement } from "react";

export interface MenuItem {
  name: string;
  icon?: ReactElement;
  href: string;
  children?: MenuItem[];
  isHeader?: boolean;
  isFooter?: boolean;
  permit?: string;
  /**
   * Sólo se ofrece en viewport mobile (< 1024px, el breakpoint `lg` del shell).
   * El sidebar lo filtra con `useIsMobileViewport()`: en desktop no se renderiza.
   */
  mobileOnly?: boolean;
}

const iconSize = 22;

export const MENU_ITEMS: MenuItem[] = [
  {
    name: "Panel de control",
    icon: <HiOutlineTemplate size={iconSize} />,
    href: "/panel",
    permit: "Panel de Control",
  },
  {
    name: "Caja de ventas",
    icon: <HiOutlineCash size={iconSize} />,
    href: "/caja-ventas",
    permit: "Caja de ventas",
  },
  {
    // "Pedidos" collided with the mobile tab of the same name, which points at
    // /registro-ordenes: the sidebar said Pedidos and the sticky mobile header
    // repeated it over a page titled Marketplace. The permit is unchanged.
    name: "Marketplace",
    icon: <HiOutlineShoppingCart size={iconSize} />,
    href: "/marketplace",
    permit: "Ordenes marketplace",
  },
  {
    name: "Registro de órdenes",
    icon: <HiOutlineClipboardList size={iconSize} />,
    href: "/registro-ordenes",
    permit: "Registro de ordenes",
  },
  {
    name: "Facturas",
    icon: <HiOutlineReceiptRefund size={iconSize} />,
    href: "/facturas",
    permit: "Facturas",
  },
  {
    name: "Productos en Stock",
    icon: <HiOutlineCube size={iconSize} />,
    href: "/productos",
    permit: "Productos en stock",
  },
  {
    // Sólo en el celular del mostrador (S8): escanear con la cámara del teléfono.
    // Comparte el `permit` de productos/inventario para no necesitar backend nuevo.
    name: "Escanear producto",
    icon: <HiOutlineQrcode size={iconSize} />,
    href: "/escaner",
    permit: "Productos en stock",
    mobileOnly: true,
  },

  {
    name: "Estadísticas",
    href: "#",
    isHeader: true,
  },
  {
    name: "Estadísticas",
    icon: <HiOutlinePresentationChartLine size={iconSize} />,
    href: "/estadisticas",
    permit: "Estadisticas",
  },
  {
    name: "Reportes",
    icon: <HiOutlineDocumentReport size={iconSize} />,
    href: "/reportes",
    permit: "Reportes",
    children: [
      {
        name: "Reportes",
        icon: <HiOutlineDocumentReport size={iconSize} />,
        href: "/reportes",
        permit: "Reportes",
      },
      {
        name: "Cierre de Caja",
        icon: <HiOutlineArchive size={iconSize} />,
        href: "/cierre-caja",
        permit: "Reportes",
      },
    ],
  },

  {
    name: "Configuraciones",
    href: "#",
    isHeader: true,
  },
  {
    name: "Configuración",
    icon: <HiOutlineCog size={iconSize} />,
    href: "/configuraciones",
  },
  {
    name: "Auditoría",
    icon: <HiOutlineArchive size={iconSize} />,
    href: "/auditoria",
    permit: "Auditoría",
  },
  {
    name: "Cerrar sesión",
    icon: <HiOutlineLogout size={iconSize} />,
    href: "#",
    isFooter: true,
  },
];

/**
 * Routes that only exist in the mobile shell, so they are not in `MENU_ITEMS`
 * (the desktop sidebar must never offer them) and would otherwise fall back to
 * the generic panel name.
 */
const MOBILE_ONLY_SECTION_NAMES: Record<string, string> = {
  "/mas": "Más",
};

/**
 * Nombre de la sección activa para un pathname.
 *
 * Es la única fuente del título del documento (`usePageTitle`) y del header
 * sticky del shell mobile: si cambia el menú, cambian los dos a la vez.
 */
export const resolveSectionName = (pathname: string): string => {
  const mobileOnlyName = MOBILE_ONLY_SECTION_NAMES[pathname];
  if (mobileOnlyName) return mobileOnlyName;

  for (const item of MENU_ITEMS) {
    if (item.href === pathname) return item.name;
    const activeChild = item.children?.find((child) => child.href === pathname);
    if (activeChild) return activeChild.name;
  }
  return "Panel General";
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Filtra el menú según los permisos del agente.
 * - `isAdmin` (o admin/superadmin) ve todo.
 * - Un ítem sin `permit` siempre se muestra (headers, footer).
 * - Los headers quedan ocultos si no les queda ningún ítem visible debajo.
 */
export const filterMenuByPermits = (
  items: MenuItem[],
  permits: string[],
  isAdmin: boolean,
): MenuItem[] => {
  if (isAdmin) return items;

  const owned = new Set(permits.map(normalize));
  const canAccess = (permit?: string) => !permit || owned.has(normalize(permit));

  const visible = items
    .filter((item) => canAccess(item.permit))
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter((c) => canAccess(c.permit)) }
        : item,
    );

  // Un header solo se mantiene si el ítem que le sigue en el menú original es visible.
  return visible.filter((item) => {
    if (!item.isHeader) return true;
    return canAccess(items[items.indexOf(item) + 1]?.permit);
  });
};