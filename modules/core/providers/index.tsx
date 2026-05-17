"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import AuthSync from "@/modules/auth/components/AuthSync";
import { MqttOrdersProvider } from "@/modules/marketplace/providers/MqttOrdersProvider";
import GlobalOrderNotifications from "@/modules/marketplace/components/GlobalOrderNotifications";
import { NotificationProvider } from "./NotificationProvider";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { setupInventoryMqttHandler } from "@/modules/core/mqtt/handlers/inventory-handler";

function CurrencyRatePoller() {
  const fetchRate = useCurrencyStore((s) => s.fetchRate);

  useEffect(() => {
    fetchRate();
    const interval = setInterval(fetchRate, 60000);
    return () => clearInterval(interval);
  }, [fetchRate]);

  return null;
}

function MqttInventorySync() {
  const pharmacyId = useAuthStore((s) => s.profile?.pharmacyId);

  useEffect(() => {
    if (!pharmacyId) return;
    const unsub = setupInventoryMqttHandler(pharmacyId);
    return () => unsub?.();
  }, [pharmacyId]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    queryCache: new QueryCache({
      onError: (err: any) => {
        if (err.message?.includes("AUTENTICACION_REQUERIDA")) {
          alert("Sesión requerida: Por favor, inicia sesión.");
        }
      },
    }),
    defaultOptions: {
      queries: { staleTime: 60000, refetchOnWindowFocus: false, retry: 1 },
      mutations: {
        onError: (err: any) => console.error("[Mutation Error]", err),
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        {/* AuthSync vive dentro del modulo auth y se encarga del store */}
        <AuthSync />
        <NotificationProvider>
          <MqttOrdersProvider>
            <GlobalOrderNotifications />
            <CurrencyRatePoller />
            <MqttInventorySync />
            {children}
          </MqttOrdersProvider>
        </NotificationProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}