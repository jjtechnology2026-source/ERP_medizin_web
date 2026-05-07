# Estadísticas

Propósito

- Proveer una vista de análisis por producto a partir de las órdenes: cantidad vendida, costo unitario, total generado y categorías.
- Permitir filtrado por fechas, categoría y búsqueda por producto; entregar paginación y métricas resumen para la UI.
- Separar responsabilidades: `index.tsx` = UI; `useStatistics` = carga, agregación y manipulación de datos.

Estructura y responsabilidades (archivo por archivo)

- `index.tsx`
  - Punto de entrada y único responsable de la UI (cards resumen, controles y tabla paginada).
  - Consume `useStatistics()` y mapea `state`, `data`, `actions` y `utils` a la vista.
  - No debe contener llamadas a la API ni lógica de transformación de datos.

- `useStatistics.ts`
  - Hook que encapsula:
    - Construcción de `query` a partir de `profile` (id_group, id_pharmacy) y rango de fechas.
    - Llamada a `useApiQuery` para obtener órdenes.
    - `aggregateProductStats` para transformar órdenes en estadísticas por producto.
    - Filtros locales (search, category), paginación y cálculos de totales.
  - API de retorno: `{ state, data, actions, utils }`.

Flujo de datos (alto nivel)

1. `useStatistics` construye `query` y llama a `useApiQuery<Order[]>(['marketplace-stats', query], `/admin/Orders/SearchOrders?${query}`)`.
2. Cuando llegan las órdenes, `aggregateProductStats(orders)` normaliza y acumula por producto.
3. Se aplican filtros locales y se calculan `currentItems`, `totalPages`, `totalQuantity` y `totalRevenue`.
4. `index.tsx` renderiza la UI consumiendo únicamente las propiedades expuestas por el hook.

Snippets y ejemplos prácticos

- Uso del hook (API agrupado):

```ts
const { state, data, actions, utils } = useStatistics();

const { search, category, currentPage, itemsPerPage } = state;
const { filteredProducts, currentItems, categories, isLoading } = data;
const { setSearch, setCategory, setCurrentPage, resetFilters } = actions;
const { formatCurrency } = utils;
```

- `aggregateProductStats` (resumen):

```ts
const aggregateProductStats = (orders: Order[]): StatProduct[] => {
  const map = new Map<string, StatProduct>();
  orders.forEach((order) => {
    order.medications?.forEach((med) => {
      // normalizar nombre, categoría, precio y cantidad
      // acumular cantidad y total por clave única
    });
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};
```

Explicación: normaliza `name`, `category`, `price` y `quantity`, combina por clave y suma `quantity` y `total`.

- Consulta (React Query / `useApiQuery`):

```ts
const { data: orders = [], isLoading } = useApiQuery<Order[]>(
  ["marketplace-stats", query],
  `/admin/Orders/SearchOrders?${query}`,
  { enabled: !!profile?.id_group },
);
```

Nota: `useApiQuery` soporta modo test (mocks). Si `NEXT_PUBLIC_TEST_MODE=true` y no obtienes mocks, revisa que la clave en `docs/mocks.ts` coincida con la URL solicitada o normaliza la URL antes de buscar el mock.

- Formateo de moneda:

```ts
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );
```

Consideraciones y recomendaciones

- Mantener `index.tsx` presentacional facilita pruebas y futuras migraciones de la agregación al backend.
- Para `NEXT_PUBLIC_TEST_MODE`:
  - El loader de mocks compara la URL con claves en `docs/mocks.ts`. Si la app añade querystring, o bien:
    - normaliza la URL antes de buscar el mock (ej. usar solo el path), o
    - añade claves por prefijo o variantes específicas en `docs/mocks.ts`.
- Performance: la agregación se realiza en cliente; para grandes volúmenes considera mover la agregación al backend o implementar endpoints que retornen agregados paginados.
- Internacionalización: extraer `formatCurrency` si se necesita multi-moneda o localización.

Mock recomendado para desarrollo local

```ts
"/admin/Orders/SearchOrders": [
  {
    id: 'ord_1',
    idGroup: 'group_1',
    pharmacy: 'Farmacia Central',
    medications: [
      { name: 'Ibuprofeno', category: 'Analgesicos', price: 5, quantity: 2 },
      { name: 'Amoxicilina', category: 'Antibioticos', price: 12, quantity: 1 }
    ],
    date: '2026-05-01T12:00:00Z'
  }
]
```

Consejo: si la app consulta la ruta con querystring, añade la variante exacta o normaliza la búsqueda del mock por path.

Siguientes pasos recomendados

- Extraer `formatCurrency` a `modules/core/utils` si se reutiliza.
- Añadir los mocks sugeridos en `docs/mocks.ts` para validar la UI en `NEXT_PUBLIC_TEST_MODE=true`.
- Puedo crear el mock y/o extraer `formatCurrency` ahora si lo deseas.
