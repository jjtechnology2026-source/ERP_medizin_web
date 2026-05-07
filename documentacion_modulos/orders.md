# Orders

Documento técnico del módulo `modules/orders`. Describe propósito, estructura, responsabilidades de cada fichero, flujo de datos y ejemplos prácticos (snippets) con explicaciones para facilitar la integración y pruebas locales.

Propósito

- Gestionar la visualización, filtrado y operaciones sobre órdenes (detalle, notas, estados, estadísticas).
- Proveer componentes reutilizables y un hook `useOrders` para encapsular la lógica de carga, paginación y acciones sobre órdenes.
- Centralizar las llamadas a la API relacionadas con órdenes en `services/OrderService.ts`.

Estructura y responsabilidades (archivo por archivo)

- `index.tsx`
  - Punto de entrada de la pantalla de órdenes. Orquesta `useOrders`, modales (`OrderDetailModal`, `NoteModal`), filtros (`OrderFilters`) y las cards estadísticas (`OrderStatsCards`).
  - Debe concentrar la orquestación: abrir/cerrar modales, pasar handlers y datos a componentes, y suscribirse a events/refresh cuando corresponda.

- `components/`
  - `OrderListTable.tsx`: Tabla/paginador que muestra la lista de órdenes. Recibe `orders`, `isLoading`, `onRowClick`, `onAddNote`, `onAccept`, `onPageChange`.
  - `OrderFilters.tsx`: Componente controlado que emite el objeto `filters` (fechas, estado, búsqueda, farmacia, etc.). No hace fetches; sólo emite cambios.
  - `OrderDetailModal.tsx`: Modal para ver/editar una orden completa.
  - `NoteModal.tsx`: Modal para agregar notas a una orden.
  - `OrderStatsCards.tsx`: Cards resumen (totales, pendientes, ingresos) para la cabecera.

- `hooks/useOrders.ts`
  - Hook que encapsula la lógica de petición, paginación y acciones (aceptar, cancelar, anotar). Normalmente usa React Query (`useQuery`/`useMutation`) y `OrderService`.
  - Exponer: `orders`, `isLoading`, `filters`, `setFilters`, `page`, `setPage`, `total`, `refresh`, y acciones (e.g., `addNote`, `acceptOrder`).

- `services/OrderService.ts`
  - Cliente HTTP que encapsula endpoints: `searchOrders`, `getOrderById`, `addNote`, `updateOrderStatus`, `exportOrders`, etc.
  - Aquí se hacen las transformaciones mínimas para que la UI reciba datos listos para render (p. ej. normalizar campos y formatos de fecha).

- `types/orders.ts`
  - Tipos e interfaces del dominio: `Order`, `OrderFilters`, `OrderStats`, `OrderNote`.

Flujo de datos (alto nivel)

1. Usuario interactúa con `OrderFilters`.
2. `index.tsx` actualiza `filters` en `useOrders`.
3. `useOrders` construye `params` y dispara la query a `OrderService.searchOrders(params)`.
4. Los datos paginados llegan y se pasan a `OrderListTable` y `OrderStatsCards`.
5. Acciones (ej. `addNote`, `acceptOrder`) llaman a `OrderService` y, tras success, invalidan/actualizan la query para refrescar la lista.

Ejemplos y fragmentos útiles

- `types/orders.ts` (ejemplo mínimo):

```ts
export interface Order {
  id: string;
  idGroup?: string;
  customer?: string;
  pharmacy?: string;
  status: string; // 'PENDING' | 'ASSIGNED' | 'COMPLETED' | ...
  total: number;
  date: string; // ISO string
  items?: any[];
}

export interface OrderFilters {
  query?: string;
  status?: string;
  dateStart?: string;
  dateEnd?: string;
  id_group?: string;
}
```

Explicación: define las formas mínimas que la UI y los servicios deben respetar. Mantén `types/orders.ts` como la fuente de verdad para evitar desajustes.

- `services/OrderService.ts` (ejemplo de uso):

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

  async addNote(id: string, note: { text: string }) {
    const res = await api.post(`/admin/Orders/${id}/notes`, note);
    return res.data;
  },

  async updateOrderStatus(id: string, status: string) {
    const res = await api.put(`/admin/Orders/${id}/status`, { status });
    return res.data;
  },
};
```

Explicación: `OrderService` centraliza llamadas y transformaciones. Úsalo en `useOrders` para aislar la lógica de red del resto del código.

- `hooks/useOrders.ts` (esqueleto de hook con React Query):

```ts
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { OrderService } from "@/modules/orders/services/OrderService";

export function useOrders(initialFilters = {}) {
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
  } = useQuery(["orders", params], () => OrderService.searchOrders(params), {
    keepPreviousData: true,
  });

  const addNoteMutation = useMutation(
    ({ id, note }) => OrderService.addNote(id, note),
    {
      onSuccess: () => refetch(),
    },
  );

  const acceptOrder = async (id: string) => {
    await OrderService.updateOrderStatus(id, "ASSIGNED");
    refetch();
  };

  return {
    orders: data,
    isLoading,
    filters,
    setFilters,
    page,
    setPage,
    addNote: addNoteMutation.mutate,
    acceptOrder,
    refresh: refetch,
  };
}
```

Explicación: `useOrders` muestra la separación de responsabilidades: calcular `params`, usar React Query para caché/refetch y exponer mutaciones con callbacks para mantener la UI en sync.

- `components/OrderListTable.tsx` (uso típico):

```tsx
<OrderListTable
  orders={orders}
  isLoading={isLoading}
  onRowClick={(id) => openOrderDetail(id)}
  onAddNote={(id) => openNoteModal(id)}
  onAccept={(id) => acceptOrder(id)}
  onPageChange={(p) => setPage(p)}
/>
```

Explicación: los componentes deben recibir datos y handlers por props; no deben conocer la lógica de fetch ni mutaciones internas. Esto facilita pruebas e independencia.

- Integración en `index.tsx` (composición y ejemplo de uso):

```tsx
import React from "react";
import { useOrders } from "./hooks/useOrders";
import OrderFilters from "./components/OrderFilters";
import OrderListTable from "./components/OrderListTable";
import OrderStatsCards from "./components/OrderStatsCards";

export default function OrdersPage() {
  const {
    orders,
    isLoading,
    filters,
    setFilters,
    page,
    setPage,
    addNote,
    acceptOrder,
  } = useOrders();

  return (
    <div>
      <OrderStatsCards />
      <OrderFilters value={filters} onChange={setFilters} />
      <OrderListTable
        orders={orders}
        isLoading={isLoading}
        onAddNote={(id) => addNote({ id, note: { text: "Nota de ejemplo" } })}
        onAccept={(id) => acceptOrder(id)}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
}
```

Explicación: este ejemplo muestra la composición típica de la página. `OrdersPage` actúa como orquestador: pasa props a componentes y delega la lógica de datos al hook.

Mock para desarrollo local

- Añade en `docs/mocks.ts` una clave para `/admin/Orders/SearchOrders` si usas el modo test. Ejemplo:

```ts
"/admin/Orders/SearchOrders": [
  {
    id: 'ord_1',
    customer: 'Paciente Demo',
    pharmacy: 'Farmacia Central',
    status: 'PENDING',
    total: 125.5,
    date: new Date().toISOString(),
    items: [{ name: 'Med A', qty: 2 }],
  },
]
```

Explicación: el mock permite probar la UI sin backend y validar que `useOrders` y `OrderListTable` funcionan con los datos esperados. Asegúrate de que `useApi` acepte esa ruta o que el mock soporte prefijos/querystrings.
