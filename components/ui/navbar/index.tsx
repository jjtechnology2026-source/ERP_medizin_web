"use client";

import React, { useState, useRef, useEffect } from "react";
import { HiMenuAlt2, HiMenu, HiOutlineBell, HiSearch, HiX } from "react-icons/hi";
import UserAvatar from "@/components/shared/dashboard/UserAvatar";
import { useUserNavbar } from "./useUserNavbar";
import { SearchBar, CurrencySwitch, NotificationsDropdown, ProfileDropdown } from "./NavbarComponents";
import { ConfirmationDialog } from "@/components/shared/modals/ConfirmationDialog";

const Logo = () => (
  <div className="flex items-center gap-3 shrink-0">
    <img src="/Logo.svg" alt="Medizin" className="w-[100px] sm:w-[120px] lg:w-[150px] h-auto object-contain" />
  </div>
);

export default function Navbar({ 
  toggleSidebar, 
  isSidebarOpen,
  isSidebarExpanded,
  onExpandToggle
}: { 
  toggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  isSidebarExpanded?: boolean;
  onExpandToggle?: () => void;
}) {
  const {
    profile,
    searchQuery,
    setSearchQuery,
    currency,
    setCurrency,
    isNotifOpen,
    setIsNotifOpen,
    isProfileOpen,
    setIsProfileOpen,
    handleLogout
  } = useUserNavbar();

  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="bg-white sticky top-0 w-full py-3 px-3 lg:py-4 lg:px-8 flex justify-between items-center border-b border-slate-100/60 z-[60] backdrop-blur-md bg-white/90 gap-2 lg:gap-10">
      
      {/* Izquierda: Logo + Hamburguesa (Móvil) */}
      <div className="flex items-center gap-4">
        <Logo />
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-slate-500 hover:text-blue-600 transition-colors p-2 rounded-xl hover:bg-slate-50"
          aria-label="Abrir menú"
        >
          <HiMenuAlt2 size={22} />
        </button>
      </div>

      {/* CENTRO: Hamburguesa Desktop + Buscador */}
      <div className="hidden lg:flex flex-1 max-w-2xl items-center gap-4 px-4">
        {/* Botón de expansión para Desktop ahora aquí */}
        <button
          onClick={onExpandToggle}
          className="text-slate-400 hover:text-blue-600 transition-all p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100"
          aria-label={isSidebarExpanded ? "Colapsar menú" : "Expandir menú"}
        >
          {isSidebarExpanded ? <HiMenu size={24} /> : <HiMenuAlt2 size={24} />}
        </button>

        {/* Buscador */}
        <div className="relative group flex-1">
          <input
            type="text"
            placeholder="¿Qué estás buscando?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F3F4F6] border-none rounded-xl py-3 pl-4 pr-12 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none placeholder:text-slate-400"
          />
          <HiSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
        </div>
      </div>

      {/* Diálogo de Cierre de Sesión */}
      <ConfirmationDialog
        isOpen={isLogoutDialogOpen}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={handleLogout}
        title="¿Cerrar sesión?"
        description="¿Estás seguro de que deseas salir de tu cuenta? Tendrás que iniciar sesión nuevamente para acceder."
        confirmLabel="Sí, salir"
        variant="danger"
      />

      {/* Derecha: Acciones - Desktop */}
      <div className="hidden lg:flex items-center gap-4">
        <CurrencySwitch currency={currency} setCurrency={setCurrency} />

        <div className="relative">
          <button
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsProfileOpen(false);
            }}
            className={`p-2.5 rounded-xl transition-all ${
              isNotifOpen ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <HiOutlineBell size={24} />
          </button>
          {isNotifOpen && <NotificationsDropdown />}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
            }}
            className="flex items-center gap-4 pl-3 py-1 pr-1 rounded-2xl hover:bg-slate-50 transition-all group"
          >
            <div className="flex flex-col items-end text-right">
              <span className="text-xs font-black text-slate-800 tracking-tight">
                @{profile?.name?.toLowerCase().replace(/\s+/g, "") || "usuario"}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {profile?.role || "Agente"}
              </span>
            </div>
            <UserAvatar
              src={profile?.image}
              className="w-10 h-10 border-2 border-white shadow-md ring-2 ring-blue-500/5 group-hover:ring-blue-500/20 transition-all"
            />
          </button>

          {isProfileOpen && <ProfileDropdown onLogout={() => setIsLogoutDialogOpen(true)} />}
        </div>
      </div>

      {/* Mobile: Botones compactos (Se mantiene igual) */}
      <div className="lg:hidden flex items-center gap-0.5">
        <div ref={searchRef}>
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-lg transition-all ${
              isSearchOpen ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
            aria-label="Buscar"
          >
            {isSearchOpen ? <HiX size={20} /> : <HiSearch size={20} />}
          </button>

          {isSearchOpen && (
            <div className="fixed top-[56px] left-2 right-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-top-2 duration-300 z-[70]">
              <div className="p-3">
                <input
                  type="text"
                  placeholder="¿Qué estás buscando?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-[#F3F4F6] border-none rounded-xl py-2.5 pl-4 pr-10 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none placeholder:text-slate-400"
                />
                <HiSearch className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              </div>
            </div>
          )}
        </div>
        <CurrencySwitch currency={currency} setCurrency={setCurrency} />
        <button
          onClick={() => {
            setIsNotifOpen(!isNotifOpen);
            setIsProfileOpen(false);
          }}
          className={`p-2 rounded-lg transition-all ${
            isNotifOpen ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <HiOutlineBell size={18} />
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
            }}
            className="flex items-center p-1"
          >
            <UserAvatar
              src={profile?.image}
              className="w-7 h-7 border border-white shadow-sm"
            />
          </button>

          {isProfileOpen && (
            <div className="absolute top-[44px] right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[70]">
              <ProfileDropdown onLogout={() => setIsLogoutDialogOpen(true)} />
            </div>
          )}
        </div>

        {isNotifOpen && (
          <div className="absolute top-[44px] right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[70]">
            <NotificationsDropdown />
          </div>
        )}
      </div>
    </nav>
  );
}