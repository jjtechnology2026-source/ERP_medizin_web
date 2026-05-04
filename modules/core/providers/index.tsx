"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import AuthSync from "@/modules/auth/components/AuthSync";
import { MqttOrdersProvider } from "@/modules/marketplace/providers/MqttOrdersProvider";
import GlobalOrderNotifications from "@/modules/marketplace/components/GlobalOrderNotifications";
import { NotificationProvider } from "./NotificationProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  // 1. Configuración compacta de React Query
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
            {children}
          </MqttOrdersProvider>
        </NotificationProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}