"use client";
import React from "react";
import { HiSearch, HiOutlineBell, HiOutlineUserCircle, HiOutlineLockClosed, HiOutlineClipboardList, HiOutlineLogout } from "react-icons/hi";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Buscador Centralizado
export const SearchBar = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="relative flex-1 max-w-md hidden md:block group">
    <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
    <input
      type="text"
      placeholder="¿Qué estás buscando?"
      className="w-full bg-slate-50/80 border-2 border-transparent rounded-[1.2rem] py-3 pl-12 pr-4 text-sm font-bold text-slate-600 focus:bg-white focus:border-blue-500/10 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none placeholder:text-slate-300 placeholder:font-medium"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

// Switch de Moneda
export const CurrencySwitch = ({ currency, setCurrency }: { currency: "BS" | "USD" | string; setCurrency: (c: any) => void }) => (
  <div className="flex items-center gap-4 px-4 py-2 bg-slate-50/50 rounded-2xl border border-slate-100/50">
    <span className="text-[12px] font-black text-blue-600 tracking-tighter">480.26 Bs</span>
    <button
      onClick={() => setCurrency(currency === "BS" ? "USD" : "BS")}
      className={cn(
        "relative w-[52px] h-[26px] bg-blue-600 rounded-full transition-all duration-500 shadow-inner flex items-center px-1",
        currency === "USD" ? "bg-slate-300" : "bg-blue-600",
      )}
    >
      <div
        className={cn(
          "w-5 h-5 bg-white rounded-full shadow-lg flex items-center justify-center transform transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          currency === "USD" ? "translate-x-6" : "translate-x-0",
        )}
      >
        <span className="text-[10px] font-black text-blue-600 select-none">{currency === "BS" ? "$" : "Bs"}</span>
      </div>
    </button>
  </div>
);

// Dropdown de Notificaciones
export const NotificationsDropdown = () => (
  <div className="absolute right-0 mt-4 w-80 bg-white border border-slate-100 rounded-[2rem] shadow-[0_20px_70px_rgba(0,0,0,0.1)] p-6 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
    <header className="flex justify-between items-center mb-6">
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Notificaciones</h3>
      <span className="text-[10px] font-black text-blue-500 cursor-pointer hover:underline">Limpiar todo</span>
    </header>
    <div className="flex flex-col gap-2">
      <NotifItem title="Nuevo Pedido" desc="Farmacia Central - #2034" color="blue" />
      <NotifItem title="Perfil Actualizado" desc="Se cambió la foto de perfil" color="emerald" />
      <NotifItem title="Error en Producto" desc="Stock agotado en Ibuprofeno" color="rose" />
    </div>
  </div>
);

const NotifItem = ({ title, desc, color }: { title: string; desc: string; color: "blue" | "emerald" | "rose" }) => {
  const colors = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    rose: "bg-rose-500",
  };
  return (
    <div className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-slate-100 group">
      <div className={cn("w-2 h-2 mt-2 rounded-full shrink-0 animate-pulse", colors[color])} />
      <div>
        <p className="text-sm font-black text-slate-700 leading-none group-hover:text-blue-600 transition-colors uppercase tracking-tight">{title}</p>
        <p className="text-xs font-medium text-slate-400 mt-1.5">{desc}</p>
      </div>
    </div>
  );
};

// Dropdown de Perfil
export const ProfileDropdown = ({ onLogout }: { onLogout: () => void }) => (
  <div className="absolute right-0 mt-4 w-64 bg-white border border-slate-100 rounded-[2rem] shadow-[0_20px_70px_rgba(0,0,0,0.1)] p-4 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
    <div className="flex flex-col gap-1.5">
      <ProfileItem icon={<HiOutlineUserCircle />} label="Mi Perfil" />
      <ProfileItem icon={<HiOutlineClipboardList />} label="Actividad" />
      <ProfileItem icon={<HiOutlineLockClosed />} label="Seguridad" />
      <div className="h-px bg-slate-50 my-2" />
      <button
        onClick={onLogout}
        className="flex items-center gap-3 w-full p-4 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all font-black text-sm group"
      >
        <HiOutlineLogout size={20} className="group-hover:translate-x-1 transition-transform" />
        Cerrar sesión
      </button>
    </div>
  </div>
);

const ProfileItem = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-slate-100 font-black text-sm text-slate-600 hover:text-blue-600">
    {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
    {label}
  </div>
);
