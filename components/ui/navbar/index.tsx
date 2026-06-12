"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { HiMenuAlt2, HiMenu, HiOutlineBell, HiSearch, HiX } from "react-icons/hi";
import UserAvatar from "@/components/shared/dashboard/UserAvatar";
import { useUserNavbar } from "./useUserNavbar";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "@/modules/core/providers/NotificationProvider";
import { NotificationsDialog } from "./NotificationsDialog";
import { SearchBar, CurrencySwitch, NotificationsDropdown, ProfileDropdown } from "./NavbarComponents";
import { ConfirmationDialog } from "@/components/shared/modals/ConfirmationDialog";
import { useProductsStore } from "@/modules/products/store/products.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { useRouter } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    isNotifOpen,
    setIsNotifOpen,
    isNotifModalOpen,
    setIsNotifModalOpen,
    isProfileOpen,
    setIsProfileOpen,
    handleLogout
  } = useUserNavbar();

  const { inventory } = useProductsStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);

  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return inventory
      .filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.barCode.toLowerCase().includes(q) ||
        m.activeIngredient.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [inventory, searchQuery]);

  const formatPrice = (price: number) => {
    if (isDollar) return `$${price.toFixed(2)}`;
    return `Bs${(price * rate).toFixed(2)}`;
  };

  const { unreadCount } = useNotifications();

  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileNotifRef = useRef<HTMLDivElement>(null);
  const mobileProfileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target) && mobileSearchRef.current && !mobileSearchRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target) && mobileNotifRef.current && !mobileNotifRef.current.contains(target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target) && mobileProfileRef.current && !mobileProfileRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsNotifOpen, setIsProfileOpen]);

  return (
    <nav className="bg-white sticky top-0 w-full py-3 px-3 lg:py-4 lg:px-8 flex justify-between items-center border-b border-slate-100/60 z-[60] backdrop-blur-md bg-white/90 gap-2 lg:gap-10">
      
      {/* Notifications Modal */}
      <NotificationsDialog 
        isOpen={isNotifModalOpen} 
        onClose={() => setIsNotifModalOpen(false)} 
      />

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
        <div className="relative group flex-1" ref={searchRef}>
          <input
            type="text"
            placeholder="¿Qué estás buscando?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            className="w-full bg-[#F3F4F6] border-none rounded-xl py-3 pl-4 pr-12 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none placeholder:text-slate-400"
          />
          <HiSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
          
          {searchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-[200] max-h-96 overflow-y-auto">
              {searchResults.map((med) => (
                <button
                  key={med.barCode}
                  onClick={() => {
                    router.push("/productos");
                    setSearchQuery("");
                    setSearchFocused(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 transition-colors border-b border-slate-50 last:border-0 text-left"
                >
                  <div className="size-9 shrink-0 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden flex items-center justify-center">
                    {med.image ? (
                      <img src={med.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs">💊</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{med.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{med.barCode} • {med.activeIngredient}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-blue-600">{formatPrice(med.price)}</p>
                    <span className={`text-[9px] font-bold ${med.stock > 0 ? "text-emerald-600" : "text-red-400"}`}>
                      {med.stock > 0 ? `${med.stock} und` : "Sin stock"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Diálogo de Cierre de Sesión */}
      <ConfirmationDialog
        isOpen={isLogoutDialogOpen}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => {
          setIsLogoutDialogOpen(false);
          handleLogout();
        }}
        title="¿Cerrar sesión?"
        description="¿Estás seguro de que deseas salir de tu cuenta? Tendrás que iniciar sesión nuevamente para acceder."
        confirmLabel="Sí, salir"
        variant="danger"
      />

      {/* Derecha: Acciones - Desktop */}
      <div className="hidden lg:flex items-center gap-4">
        <CurrencySwitch />

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsProfileOpen(false);
            }}
            className={`p-2.5 rounded-xl transition-all relative group ${
              isNotifOpen ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <HiOutlineBell size={24} className={cn("transition-transform", isNotifOpen && "scale-110")} />
            
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  key={unreadCount}
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg ring-4 ring-rose-500/10 z-10"
                >
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-20" />
                  <span className="relative">
                    {unreadCount > 9 ? "+9" : unreadCount}
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          {isNotifOpen && (
            <NotificationsDropdown 
              onClose={() => setIsNotifOpen(false)}
              onShowAll={() => {
                setIsNotifModalOpen(true);
                setIsNotifOpen(false);
              }} 
            />
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
            }}
            className="flex items-center gap-4 pl-3 py-1 pr-1 rounded-2xl hover:bg-slate-50 transition-all group"
          >
            <div className="flex flex-col items-end text-right">
              <span className="text-xs font-black text-slate-800 tracking-tight">
                @{typeof profile?.name === "string" && profile.name ? profile.name.toLowerCase().replace(/\s+/g, "") : "usuario"}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {profile?.role || "Agente"}
              </span>
            </div>
            <div className="p-0.5 bg-white rounded-full ring-2 ring-slate-100 group-hover:ring-blue-100 transition-all">
              <UserAvatar 
                src={profile?.image} 
                className="w-9 h-9 border border-white shadow-sm"
              />
            </div>
          </button>

          {isProfileOpen && (
            <ProfileDropdown 
              onLogout={() => {
                setIsLogoutDialogOpen(true);
                setIsProfileOpen(false);
              }} 
            />
          )}
        </div>
      </div>

      {/* Mobile: Botones compactos (Se mantiene igual) */}
      <div className="lg:hidden flex items-center gap-0.5">
        <div ref={mobileSearchRef}>
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
        <CurrencySwitch />
        <div ref={mobileNotifRef} className="flex items-center">
          <button
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsProfileOpen(false);
            }}
            className={`p-2 rounded-lg transition-all relative ${
              isNotifOpen ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <HiOutlineBell size={18} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  key={unreadCount}
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white shadow-sm ring-2 ring-rose-500/10 z-10"
                >
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-20" />
                  <span className="relative">
                    {unreadCount > 9 ? "+" : unreadCount}
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          {isNotifOpen && (
            <NotificationsDropdown 
              onClose={() => setIsNotifOpen(false)}
              onShowAll={() => {
                setIsNotifModalOpen(true);
                setIsNotifOpen(false);
              }} 
            />
          )}
        </div>

        <div className="relative" ref={mobileProfileRef}>
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
            <ProfileDropdown 
              onLogout={() => {
                setIsLogoutDialogOpen(true);
                setIsProfileOpen(false);
              }} 
            />
          )}
        </div>
      </div>
    </nav>
  );
}