import {
  HiOutlineTemplate,
  HiOutlineCash,
  HiOutlineShoppingCart,
  HiOutlineClipboardList,
  HiOutlineCube,
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
}

const iconSize = 22;

export const MENU_ITEMS: MenuItem[] = [
  {
    name: "Panel de control",
    icon: <HiOutlineTemplate size={iconSize} />,
    href: "/panel",
  },
  {
    name: "Caja de ventas",
    icon: <HiOutlineCash size={iconSize} />,
    href: "/caja-ventas",
  },
  {
    name: "Pedidos",
    icon: <HiOutlineShoppingCart size={iconSize} />,
    href: "/marketplace",
  },
  {
    name: "Registro de órdenes",
    icon: <HiOutlineClipboardList size={iconSize} />,
    href: "/registro-ordenes",
  },
  {
    name: "Facturas",
    icon: <HiOutlineReceiptRefund size={iconSize} />,
    href: "/facturas",
  },
  {
    name: "Productos en Stock",
    icon: <HiOutlineCube size={iconSize} />,
    href: "/productos",
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
  },
  {
    name: "Reportes",
    icon: <HiOutlineDocumentReport size={iconSize} />,
    href: "/reportes",
    children: [
      {
        name: "Reportes",
        icon: <HiOutlineDocumentReport size={iconSize} />,
        href: "/reportes",
      },
      {
        name: "Cierre de Caja",
        icon: <HiOutlineArchive size={iconSize} />,
        href: "/cierre-caja",
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
  },
  {
    name: "Cerrar sesión",
    icon: <HiOutlineLogout size={iconSize} />,
    href: "#",
    isFooter: true,
  },
];