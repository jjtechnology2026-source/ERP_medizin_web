"use client";
import React from "react";
import { HiSearch, HiX, HiOutlineBell, HiOutlineUserCircle, HiOutlineLockClosed, HiOutlineClipboardList, HiOutlineLogout, HiOutlineShoppingCart, HiOutlineUser, HiOutlineInformationCircle } from "react-icons/hi";
import { motion } from "framer-motion";
import { useNotifications } from "@/modules/core/providers/NotificationProvider";
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
export const NotificationsDropdown = ({ onShowAll, onClose }: { onShowAll?: () => void; onClose?: () => void }) => {
  const { notifications, markAllAsRead } = useNotifications();
  const recentNotifications = notifications.slice(0, 3);

  return (
    <>
      {/* Mobile Overlay Background */}
      <div 
        className="fixed inset-0 bg-slate-900/5 backdrop-blur-sm z-[90] lg:hidden" 
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "fixed lg:absolute top-[80px] lg:top-full left-4 right-4 lg:left-auto lg:right-0 mt-2",
          "lg:w-[420px] bg-white/95 backdrop-blur-xl border border-slate-100/50 rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] p-6 lg:p-8",
          "z-[100] overflow-hidden"
        )}
      >
        <header className="flex justify-between items-center mb-6 px-1">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="lg:hidden p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all"
            >
              <HiX size={18} />
            </button>
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight">Notificaciones</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recientes</p>
            </div>
          </div>
          <button 
            onClick={markAllAsRead}
            className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-all bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full"
          >
            Marcar leído
          </button>
        </header>
        
        <div className="flex flex-col gap-2">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                <HiOutlineBell className="text-slate-300 w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-slate-300">No hay notificaciones</p>
            </div>
          ) : (
            recentNotifications.map((notif) => (
              <NotifItem 
                key={notif.id}
                type={notif.type}
                title={notif.title} 
                desc={notif.message} 
                read={notif.read}
              />
            ))
          )}
        </div>

        <div className="h-px bg-slate-100/50 my-6 mx-2" />
        
        <button 
          onClick={onShowAll}
          className="w-full text-center py-3.5 text-sm font-black text-slate-400 hover:text-blue-600 transition-all rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-50 group flex items-center justify-center gap-2"
        >
          <span>Ver todo el historial</span>
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors" />
          </div>
        </button>
      </motion.div>
    </>
  );
};

const NotifItem = ({ title, desc, type, read }: { title: string; desc: string; type: 'order' | 'profile' | 'alert', read: boolean }) => {
  const configs = {
    order: {
      icon: <HiOutlineShoppingCart size={20} />,
      bg: "bg-[#00D1FF]",
      text: "text-white"
    },
    profile: {
      icon: <HiOutlineUser size={20} />,
      bg: "bg-[#4A69BD]",
      text: "text-white"
    },
    alert: {
      icon: <HiOutlineInformationCircle size={20} />,
      bg: "bg-[#6A89CC]",
      text: "text-white"
    }
  };

  const config = configs[type];

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-[2rem] cursor-pointer transition-all border border-transparent hover:bg-slate-50 group",
      !read && "bg-blue-50/20 shadow-sm border-blue-50/50"
    )}>
      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm relative", config.bg, config.text)}>
        {config.icon}
        {!read && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-500 border-2 border-white rounded-full" />}
      </div>
      <div className="flex-grow overflow-hidden">
        <p className="text-[14px] font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors tracking-tight truncate">
          {title}
        </p>
        <p className="text-[12px] font-bold text-slate-400 mt-0.5 truncate leading-none">
          {desc}
        </p>
      </div>
      {!read && (
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
      )}
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
