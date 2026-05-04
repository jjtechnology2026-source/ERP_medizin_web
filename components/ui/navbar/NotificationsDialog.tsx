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

const ITEMS_PER_PAGE = 10;

export function NotificationsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { notifications, clearNotifications, markAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState<"order" | "profile" | "alert">("order");
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNotificationClick = (notif: { id: string; type: string; orderId?: string }) => {
    markAsRead(notif.id);
    if (notif.type === "order") {
      const orderQuery = notif.orderId ? `?order=${encodeURIComponent(notif.orderId)}` : "";
      router.push(`/marketplace${orderQuery}`);
      onClose();
      return;
    }
    onClose();
  };

  const filteredNotifs = useMemo(() => notifications.filter((n) => n.type === activeTab), [notifications, activeTab]);

  const totalPages = Math.ceil(filteredNotifs.length / ITEMS_PER_PAGE);
  const paginatedNotifs = filteredNotifs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const tabs = [
    { id: "order", label: "Órdenes", icon: <HiOutlineShoppingCart /> },
    { id: "profile", label: "Perfil", icon: <HiOutlineUser /> },
    { id: "alert", label: "Alertas", icon: <HiOutlineInformationCircle /> },
  ] as const;

  if (!mounted) return null;

  return createPortal(
    <ModalWrapper isOpen={isOpen} onClose={onClose} zIndex={50}>
      <div className="w-[95vw] md:w-[600px] h-fit max-h-[min(90vh,760px)] flex flex-col bg-white">
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white sticky top-0 z-10 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">Notificaciones</h2>
            <p className="text-[13px] font-bold text-slate-500">Gestiona tus alertas y actividad</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center p-2.5 bg-slate-50 text-slate-500 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95"
            aria-label="Cerrar notificaciones"
          >
            <HiX size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 py-3 sm:px-6 sm:py-4 bg-white border-b border-slate-100 flex flex-col gap-3 shrink-0">
          <style jsx>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={clsx(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[13px] transition-all active:scale-95 min-w-[110px] flex-1",
                  activeTab === tab.id ? "bg-blue-600 text-white shadow-lg shadow-blue-100/50" : "bg-slate-50 text-slate-500 hover:bg-slate-100",
                )}
              >
                {React.cloneElement(tab.icon as React.ReactElement<{ size?: number }>, { size: 16 })}
                {tab.label}
                <span
                  className={clsx(
                    "ml-1 px-1.5 py-0.5 rounded-lg text-[9px]",
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500",
                  )}
                >
                  {notifications.filter((n) => n.type === tab.id).length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => clearNotifications(activeTab)}
              className="inline-flex items-center justify-center p-2.5 text-slate-400 hover:text-rose-500 rounded-2xl hover:bg-slate-50 transition-colors"
              title="Limpiar pestaña"
            >
              <HiOutlineTrash size={18} />
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-grow overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 no-scrollbar min-h-[260px]">
          {paginatedNotifs.length === 0 ? (
            <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-center opacity-50 py-10">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <HiOutlineBell className="text-slate-300 w-8 h-8" />
              </div>
              <p className="text-slate-400 font-black text-sm tracking-tight">No hay nada por aquí todavía</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {paginatedNotifs.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={clsx(
                    "flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-[1.5rem] border transition-all cursor-pointer group",
                    notif.read ? "bg-white border-slate-100 opacity-70" : "bg-blue-50/15 border-blue-100/40 hover:border-blue-200 shadow-sm",
                  )}
                >
                  <div
                    className={clsx(
                      "w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                      notif.type === "order"
                        ? "bg-[#00D1FF] text-white"
                        : notif.type === "profile"
                          ? "bg-[#4A69BD] text-white"
                          : "bg-[#6A89CC] text-white",
                    )}
                  >
                    {notif.type === "order" ? (
                      <HiOutlineShoppingCart size={18} />
                    ) : notif.type === "profile" ? (
                      <HiOutlineUser size={18} />
                    ) : (
                      <HiOutlineInformationCircle size={18} />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-1">
                      <h4 className="font-black text-slate-800 tracking-tight leading-none text-sm truncate pr-2">{notif.title}</h4>
                      <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 leading-tight truncate">{notif.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200 transition-all active:scale-95"
          >
            Cerrar
          </button>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                router.push("/marketplace");
                onClose();
              }}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all active:scale-95"
            >
              Ir a Marketplace
            </button>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-3 bg-white border border-slate-100 rounded-2xl disabled:opacity-30 hover:shadow-md transition-all active:scale-90"
                >
                  <HiChevronLeft size={20} />
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-3 bg-white border border-slate-100 rounded-2xl disabled:opacity-30 hover:shadow-md transition-all active:scale-90"
                >
                  <HiChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalWrapper>,
    document.body,
  );
}
