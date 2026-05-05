"use client";
import React from "react";
import { HiSearch, HiX, HiOutlineBell, HiOutlineUserCircle, HiOutlineLockClosed, HiOutlineClipboardList, HiOutlineLogout, HiOutlineShoppingCart, HiOutlineUser, HiOutlineInformationCircle } from "react-icons/hi";
import { motion } from "framer-motion";
import { useNotifications } from "@/modules/core/providers/NotificationProvider";
import { cn } from "@/modules/core/utils/ui";

export const SearchBar = ({ value, onChange }: any) => (
  <div className="relative flex-1 max-w-md hidden md:block group">
    <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500" size={20} />
    <input type="text" placeholder="¿Qué buscas?" className="w-full bg-slate-50/80 border-2 border-transparent rounded-xl py-2.5 pl-12 pr-4 text-sm font-bold text-slate-600 focus:bg-white focus:border-blue-500/10 outline-none transition-all" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export const CurrencySwitch = ({ currency, setCurrency }: any) => (
  <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50/50 rounded-xl border border-slate-100/50">
    <span className="text-[11px] font-black text-blue-600">48.26 Bs</span>
    <button onClick={() => setCurrency(currency === "BS" ? "USD" : "BS")} className={cn("relative w-11 h-6 rounded-full transition-all flex items-center px-1", currency === "USD" ? "bg-slate-300" : "bg-blue-600")}>
      <div className={cn("w-4 h-4 bg-white rounded-full shadow transition-transform", currency === "USD" ? "translate-x-5" : "translate-x-0")} />
    </button>
  </div>
);

export const NotificationsDropdown = ({ onShowAll, onClose }: any) => {
  const { notifications, markAllAsRead } = useNotifications();
  const items = notifications.slice(0, 3);
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-[2px] z-[90] lg:hidden" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="fixed lg:absolute top-[70px] lg:top-[calc(100%+12px)] left-4 right-4 lg:left-auto lg:right-0 lg:w-[400px] bg-white border border-slate-100 rounded-[2.2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-6 z-[100]">
        <div className="flex justify-between items-center mb-6 px-1">
          <h3 className="text-lg font-black text-slate-800 tracking-tight">Notificaciones</h3>
          <div className="flex items-center gap-2">
            <button onClick={markAllAsRead} className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-all">Marcar leído</button>
            <button onClick={onClose} className="lg:hidden p-2 bg-white border border-slate-100 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm">
              <HiX size={16} />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {items.length ? items.map((n: any) => (
            <div key={n.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all group cursor-pointer border border-transparent hover:border-slate-50">
              <div className={cn("w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm transition-all group-hover:scale-105", n.type === 'order' ? 'bg-cyan-400' : 'bg-blue-500')}>
                {n.type === 'order' ? <HiOutlineShoppingCart size={20} /> : <HiOutlineUser size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 truncate tracking-tight">{n.title}</p>
                <p className="text-[12px] text-slate-500 font-medium leading-tight truncate mt-0.5">{n.message}</p>
              </div>
            </div>
          )) : <div className="py-10 text-center text-slate-300 font-bold text-sm">Sin notificaciones</div>}
        </div>
        <button onClick={onShowAll} className="w-full mt-4 pt-4 border-t border-slate-50 text-xs font-black text-slate-400 hover:text-blue-600 transition-colors">Ver historial</button>
      </motion.div>
    </>
  );
};

export const ProfileDropdown = ({ onLogout }: { onLogout: () => void }) => {
  const items = [
    { icon: <HiOutlineUserCircle />, label: "Mi Perfil" },
    { icon: <HiOutlineClipboardList />, label: "Actividad" },
    { icon: <HiOutlineLockClosed />, label: "Seguridad" }
  ];
  return (
    <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-100 rounded-[1.8rem] shadow-2xl p-4 z-[110] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-4 p-3.5 hover:bg-slate-50 rounded-2xl cursor-pointer font-black text-sm text-slate-600 hover:text-blue-600 transition-all group">
            <span className="text-slate-400 group-hover:text-blue-500 transition-colors">{React.cloneElement(it.icon as any, { size: 22 })}</span>
            {it.label}
          </div>
        ))}
        <div className="h-px bg-slate-50 my-3 mx-2" />
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLogout(); }} className="flex items-center gap-4 w-full p-3.5 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all font-black text-sm group cursor-pointer">
          <HiOutlineLogout size={22} className="group-hover:translate-x-1 transition-transform pointer-events-none" />
          <span className="pointer-events-none">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
};
