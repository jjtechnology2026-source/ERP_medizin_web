# Marketplace

Documento técnico del módulo `modules/marketplace`. Incluye propósito, estructura, responsabilidades por fichero, flujo de datos y ejemplos prácticos (snippets) para integrar y entender rápidamente el módulo.

Propósito

- Gestionar la visualización y manipulación de órdenes del marketplace (listado, filtros, detalle, notificaciones en tiempo real).
- Exponer hooks y servicios que encapsulan llamadas a la API y lógica de negocio relacionada con órdenes.
- Proveer componentes reutilizables para la UI: tablas, filtros, modales y notificaciones.

Estructura y responsabilidades (archivo por archivo)

- `index.tsx`
  - Punto de entrada de la pantalla del marketplace. Orquesta hooks, providers (p. ej. `MqttOrdersProvider`) y componentes visuales (`MarketplaceTable`, `MarketplaceFilters`, `MarketplaceStats`).
  - Responsable de componer la vista: cargar filtros iniciales, pasar handlers a los componentes y manejar apertura de modales.

- `components/`
  - `MarketplaceTable.tsx`: Tabla principal que muestra las órdenes. Debe recibir datos paginados, handlers para acciones (aceptar, asignar, ver detalle) y mostrar estados de carga/empty/error.
  - `MarketplaceFilters.tsx`: Panel de filtros (fechas, estado, búsqueda por cliente/ID, farmacia) que emite un objeto `filters` al padre.
  - `MarketplaceStats.tsx`: Cards o gráficas con métricas (total órdenes, pendientes, entregadas, ingresos).
  - `MarketplaceDetailModal.tsx` / `MarketplaceOrderModal.tsx`: Modales para ver/editar detalles de una orden.
  - `GlobalOrderNotifications.tsx`: Visualiza alertas globales de nuevas órdenes (puede estar conectado al provider MQTT).
  - `Tooltip.tsx`: Helper de UI para información contextual.

- `hooks/useMarketplace.ts`
  - Hook que encapsula la lógica de carga y manipulación de órdenes. Suele usar `useApiQuery`/React Query y `OrderService`.
  - Provee: `orders`, `isLoading`, `filters`, `setFilters`, `page`, `setPage`, `total`, `refresh`, y acciones (aceptarOrder, cancelarOrder, etc.).

- `providers/MqttOrdersProvider.tsx`
  - Provider React que abre una conexión MQTT y emite eventos (nueva orden, cambio de estado) al contexto.
  - Componentes como `GlobalOrderNotifications` o el `index.tsx` pueden suscribirse a ese contexto para actualizar la UI en tiempo real.

- `services/OrderService.ts`
  - Cliente/encapsulador de llamadas a la API relacionadas con órdenes: `searchOrders`, `getOrderById`, `updateOrder`, `assignOrder`, `createOrder`, etc.
  - Centraliza transformaciones puntuales y manejo de schemas/respuestas. Evita lógica de negocio en componentes.

- `types/mqtt-orders.ts`
  - Tipos que describen mensajes MQTT que el provider emite (`NewOrderMessage`, `OrderUpdatedMessage`, etc.).

Flujo de datos (alto nivel)

1. El usuario ajusta filtros en `MarketplaceFilters`.
2. `useMarketplace` calcula parámetros (filtros + paginación) y llama a `OrderService.searchOrders(params)` o usa React Query para la consulta.
3. La respuesta llega paginada y se manda a `MarketplaceTable` para render.
4. Si el `MqttOrdersProvider` recibe un evento de nueva orden o actualización, propaga el evento; `useMarketplace` o el `index.tsx` deberían escuchar y refrescar datos o insertar la orden en la lista.
5. Las acciones sobre una orden (aceptar, asignar) llaman a `OrderService.updateOrder(...)`, que a su vez actualiza la lista local o invalida la query para refetch.

Ejemplos y snippets útiles

- Tipos (ejemplo mínimo de `types/mqtt-orders.ts` y `Order`):

```ts
// types/mqtt-orders.ts
export interface NewOrderMessage {
  id: string;
  payload: any; // estructura según tu API
}

export interface Order {
  id: string;
  customer: string;
  status: string; // e.g., 'PENDING' | 'ASSIGNED' | 'COMPLETED'
  total: number;
  date: string; // ISO
  pharmacy?: string;
}
```

Explicación: los tipos muestran la estructura mínima esperada para mensajes MQTT y órdenes en la UI. Úsalos como guía para validar la entrada del provider y el shape de los datos devueltos por `OrderService`.

- `OrderService.ts` (ejemplo de funciones):

```ts
import api from "@/modules/core/api/client";

export const OrderService = {
  async searchOrders(params: Record<string, any>) {
    const res = await api.get("/admin/Orders/SearchOrders", { params });
    return res.data?.result || res.data?.data || res.data || [];
  },

  async getOrderById(id: string) {
    const res = await api.get(`/admin/Orders/${id}`);
    return res.data;
  },

  async updateOrder(id: string, payload: any) {
    const res = await api.put(`/admin/Orders/${id}`, payload);
    return res.data;
  },
};
```

- `useMarketplace.ts` (esqueleto de hook):

```ts
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { OrderService } from "@/modules/marketplace/services/OrderService";

export function useMarketplace(initialFilters = {}) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const limit = 20;

  const params = useMemo(
    () => ({ ...filters, offset: (page - 1) * limit, limit }),
    [filters, page],
  );

  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery(
    ["marketplace-orders", params],
    () => OrderService.searchOrders(params),
    { keepPreviousData: true },
  );

  const acceptOrder = async (id: string) => {
    await OrderService.updateOrder(id, { status: "ASSIGNED" });
    refetch();
  };

  return {
    orders: data,
    isLoading,
    filters,
    setFilters,
    page,
    setPage,
    acceptOrder,
    refresh: refetch,
  };
}
```

Explicación: `OrderService` encapsula llamadas HTTP relacionadas con órdenes. Mantén aquí transformaciones y normalizaciones para que los consumidores (hooks y componentes) reciban datos listos para mostrar.

Explicación: el hook `useMarketplace` demuestra la separación de responsabilidades: calcular `params`, usar React Query y exponer acciones. Sirve como plantilla para manejar paginación y actualizar la lista tras acciones.

- `MqttOrdersProvider.tsx` (uso conceptual):

```tsx
import React, { createContext, useEffect } from "react";
import { connectToMqtt } from "@/modules/core/mqtt"; // util hipotético

export const OrdersContext = createContext(null);

export function MqttOrdersProvider({ children }) {
  useEffect(() => {
    const client = connectToMqtt();
    client.subscribe("orders/new");
    client.on("message", (topic, message) => {
      // parse y emitir evento al context
    });
    return () => client.end();
  }, []);

  return <OrdersContext.Provider value={{}}>{children}</OrdersContext.Provider>;
}
```

Explicación: el provider muestra la idea de mantener la conexión MQTT separada y emitir eventos por contexto. Implementa parseo y normalización dentro del provider para que el resto de la app reciba mensajes limpios.

- Integración en `index.tsx` (composición y ejemplo de uso):

```tsx
import React from "react";
import { MqttOrdersProvider } from "./providers/MqttOrdersProvider";
import MarketplaceFilters from "./components/MarketplaceFilters";
import MarketplaceTable from "./components/MarketplaceTable";
import { useMarketplace } from "./hooks/useMarketplace";

export default function MarketplacePage() {
  const { orders, isLoading, filters, setFilters, page, setPage, acceptOrder } =
    useMarketplace();

  return (
    <MqttOrdersProvider>
      <div>
        <MarketplaceFilters value={filters} onChange={setFilters} />
        <MarketplaceTable
          orders={orders}
          isLoading={isLoading}
          onAccept={(id) => acceptOrder(id)}
          onPageChange={(p) => setPage(p)}
        />
      </div>
    </MqttOrdersProvider>
  );
}
```

Explicación: el ejemplo de integración muestra la composición típica: provider arriba, filtros y tabla como hijos. Asegura que `useMarketplace` y los componentes sean independientes y comunicados mediante props/context.
