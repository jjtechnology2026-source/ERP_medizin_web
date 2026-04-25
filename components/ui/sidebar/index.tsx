"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { HiX } from "react-icons/hi";
import { cn } from "@/modules/core/utils/ui"; 
import { SidebarItem, SidebarHeader } from "./SidebarComponents";
import { MENU_ITEMS } from "./menuConstants";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { ConfirmationDialog } from "@/components/shared/modals/ConfirmationDialog";

export default function Sidebar({ 
  isOpen = false, 
  onClose, 
  isExpanded: externalExpanded, 
  onExpandToggle 
}: { 
  isOpen?: boolean; 
  onClose?: () => void;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const pathname = usePathname();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const { logout } = useAuth();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const handleExpandToggle = () => {
    if (onExpandToggle) {
      onExpandToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  const handleLogout = () => {
    setIsLogoutDialogOpen(true);
  };

  const confirmLogout = async () => {
    setIsLogoutDialogOpen(false);
    await logout();
  };

  const isActive = (href: string) => {
    if (href === "#") return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleToggleSubmenu = (menuName: string) => {
    if (!isExpanded) {
      setInternalExpanded(true);
      setOpenSubmenu(menuName);
      return;
    }
    setOpenSubmenu(openSubmenu === menuName ? null : menuName);
  };

  return (
    <aside
      className={cn(
        "h-full bg-white border-r border-slate-100 transition-all duration-500 ease-in-out z-40 flex flex-col shadow-[10px_0_40px_rgba(0,0,0,0.02)]",
        isExpanded ? "w-[260px]" : "w-[80px]",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        isOpen && "fixed inset-y-0 left-0 lg:relative"
      )}
    >
      {/* Header con botón cerrar en móvil */}
      {isOpen && onClose && (
        <div className="lg:hidden flex justify-end p-3 border-b border-slate-100">
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Cerrar menú"
          >
            <HiX size={20} />
          </button>
        </div>
      )}

      {/* Botón para colapsar/expandir (opcional, integrado en el diseño) */}
      <nav className="flex-1 overflow-y-auto px-3 py-6 scrollbar-hide space-y-1">
        {MENU_ITEMS.map((item, index) => (
          <React.Fragment key={index}>
            {item.isHeader ? (
              <SidebarHeader name={item.name} isExpanded={isExpanded} />
            ) : (
              <SidebarItem
                item={item}
                isExpanded={isExpanded}
                active={isActive(item.href)}
                isOpen={openSubmenu === item.name}
                onToggle={() => (item.children ? handleToggleSubmenu(item.name) : null)}
                onCollapse={() => handleExpandToggle()} // Control local de expansión
                onClick={item.name === "Cerrar sesión" ? handleLogout : undefined}
              />
            )}

            {/* Submenús */}
            {item.children && isExpanded && openSubmenu === item.name && (
              <div className="ml-9 mt-1 border-l-2 border-slate-50 flex flex-col gap-1 mb-4 animate-in slide-in-from-top-2 duration-300">
                {item.children.map((child, idx) => (
                  <SidebarItem 
                    key={idx} 
                    item={child} 
                    isExpanded={isExpanded} 
                    active={isActive(child.href)} 
                  />
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Footer del Sidebar - Desktop: expandir/colapsar | Mobile: botón cerrar */}
      <div className={cn("p-6 border-t border-slate-100 flex justify-center", !isExpanded && "p-4")}>
        <button 
          onClick={handleExpandToggle}
          className="w-full flex justify-center hover:bg-slate-50 py-2 rounded-xl transition-colors"
        >
          <div className={cn(
            "w-2 h-2 rounded-full bg-blue-500 transition-all duration-500",
            !isExpanded && "bg-slate-200"
          )} />
        </button>
      </div>

      {/* Diálogo de Cierre de Sesión */}
      <ConfirmationDialog
        isOpen={isLogoutDialogOpen}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={confirmLogout}
        title="¿Cerrar sesión?"
        description="¿Estás seguro de que deseas salir de tu cuenta? Tendrás que iniciar sesión nuevamente para acceder."
        confirmLabel="Sí, salir"
        variant="danger"
      />
    </aside>
  );
}