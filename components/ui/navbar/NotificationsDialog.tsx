"use client";
import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  HiOutlineShoppingCart,
  HiOutlineUser,
  HiOutlineInformationCircle,
  HiX,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineTrash,
  HiOutlineBell,
} from "react-icons/hi";
import { useNotifications } from "@/modules/core/providers/NotificationProvider";
import { clsx } from "clsx";
import ModalWrapper from "@/components/shared/modals/ModalWrapper";

const ITEMS_PER_PAGE = 4;

export function NotificationsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { notifications, clearNotifications, markAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState<"order" | "profile" | "alert">("order");
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNotificationClick = (notif: any) => {
    markAsRead(notif.id);
    if (notif.type === "order") {
      router.push(`/marketplace${notif.orderId ? `?order=${notif.orderId}` : ""}`);
      onClose();
      return;
    }
    onClose();
  };

  const filteredNotifs = useMemo(() => notifications.filter((n) => n.type === activeTab), [notifications, activeTab]);
  const paginatedNotifs = filteredNotifs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredNotifs.length / ITEMS_PER_PAGE);

  const tabs = [
    { id: "order", label: "Órdenes", icon: <HiOutlineShoppingCart /> },
    { id: "profile", label: "Perfil", icon: <HiOutlineUser /> },
    { id: "alert", label: "Alertas", icon: <HiOutlineInformationCircle /> },
  ] as const;

  if (!mounted) return null;

  return createPortal(
    <ModalWrapper isOpen={isOpen} onClose={onClose} zIndex={100}>
      <div className="w-[92vw] max-w-[440px] bg-white rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-slate-100 mx-auto">
        {/* Header */}
        <header className="p-5 flex items-center justify-between border-b border-slate-50 bg-white sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-none mb-1">Notificaciones</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Actividad Reciente</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all">
            <HiX size={16} />
          </button>
        </header>

        {/* Tabs - Scrollable en móvil */}
        <div className="p-5 bg-white space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border shrink-0 text-xs",
                  activeTab === tab.id
                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100"
                    : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200",
                )}
              >
                {React.cloneElement(tab.icon as any, { size: 16 })}
                <span>{tab.label}</span>
                <span
                  className={clsx(
                    "px-1.5 py-0.5 rounded text-[9px] font-black",
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-400",
                  )}
                >
                  {notifications.filter((n) => n.type === tab.id).length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Historial</span>
            <button
              onClick={() => clearNotifications(activeTab)}
              className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors"
            >
              Limpiar <HiOutlineTrash size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 max-h-[260px] no-scrollbar pb-5">
          {paginatedNotifs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
              <HiOutlineBell size={40} className="mb-2" />
              <p className="font-black text-[9px] uppercase tracking-widest">Sin actividad</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedNotifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={clsx(
                    "flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer",
                    n.read ? "bg-white border-slate-100 opacity-40" : "bg-blue-50/20 border-blue-100/40 hover:border-blue-200",
                  )}
                >
                  <div
                    className={clsx(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white",
                      n.type === "order" ? "bg-cyan-400" : n.type === "profile" ? "bg-blue-500" : "bg-indigo-400",
                    )}
                  >
                    {n.type === "order" ? <HiOutlineShoppingCart size={16} /> : <HiOutlineUser size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="font-black text-slate-800 text-[11px] truncate">{n.title}</p>
                      <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">
                        {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 truncate leading-normal">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-5 border-t border-slate-50 bg-slate-50/50 flex flex-col gap-3">
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Pág {page} de {totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 bg-white border border-slate-100 rounded-lg disabled:opacity-20 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <HiChevronLeft size={16} />
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 bg-white border border-slate-100 rounded-lg disabled:opacity-20 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <HiChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-400 font-black text-[9px] rounded-xl hover:bg-slate-50 transition-all uppercase tracking-widest shadow-sm"
            >
              Cerrar
            </button>
            <button
              onClick={() => {
                router.push("/marketplace");
                onClose();
              }}
              className="flex-1 py-2.5 bg-blue-600 text-white font-black text-[9px] rounded-xl hover:bg-blue-700 transition-all uppercase tracking-widest truncate shadow-sm"
            >
              Marketplace
            </button>
          </div>
        </footer>
      </div>
    </ModalWrapper>,
    document.body,
  );
}
