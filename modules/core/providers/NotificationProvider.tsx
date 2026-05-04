"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { AppNotification, NotificationState, NotificationType } from "../types/notifications";

const NotificationContext = createContext<NotificationState | null>(null);

const MAX_NOTIFICATIONS = 50;

const MOCK_NOTIFS: AppNotification[] = [
  {
    id: "m0",
    type: "order",
    title: "Nuevo pedido",
    message: "Se ha registrado un nuevo pedido de Jesús Márquez (#8X0PYTPK)",
    timestamp: new Date().toISOString(),
    read: false,
  },
  {
    id: "m1",
    type: "profile",
    title: "Perfil Actualizado",
    message: "Tu foto de perfil ha sido actualizada con éxito.",
    timestamp: new Date().toISOString(),
    read: true,
  },
  {
    id: "m2",
    type: "alert",
    title: "Error en Inventario",
    message: "El producto 'Ibuprofeno 500mg' tiene bajo stock.",
    timestamp: new Date().toISOString(),
    read: false,
  }
];

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(MOCK_NOTIFS);

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length, 
  [notifications]);

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notif,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback((type?: NotificationType) => {
    if (type) {
      setNotifications(prev => prev.filter(n => n.type !== type));
    } else {
      setNotifications([]);
    }
  }, []);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  }), [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearNotifications]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
