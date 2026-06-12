"use client";
import { useEffect } from "react";
import { usePendingOrdersStore } from "@/modules/cash-register/store/pending-orders.store";

export default function SyncManager() {
  const syncPendingOrders = usePendingOrdersStore((s) => s.syncPendingOrders);
  const orders = usePendingOrdersStore((s) => s.orders);

  // Sincronizar al iniciar
  useEffect(() => {
    if (orders.length > 0) {
      syncPendingOrders();
    }
  }, []); // solo al montar

  // Escuchar evento online del navegador
  useEffect(() => {
    const handleOnline = () => {
      syncPendingOrders();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPendingOrders]);

  return null; // no renderiza nada
}