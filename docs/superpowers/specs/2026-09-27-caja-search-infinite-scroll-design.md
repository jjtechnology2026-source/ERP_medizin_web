# Caja — búsqueda de productos con carga automática al final

**Fecha:** 2026-09-27
**Módulo:** `modules/cash-register` + `modules/products/store`

## Objetivo

Quitar el botón "Siguiente" de la modal de búsqueda de productos de Caja. Cuando el usuario
llega al final de lo cargado, la siguiente sección se carga sola.

## Contexto

Hoy `ProductSearchDialog.tsx` pagina con botones "Anterior"/"Siguiente" sobre
`useProductsStore`, que expone `inventory` (una sola página de 10), `page`, `hasMore` y
`setPage`.

Ese estado **no es exclusivo de la modal**. Lo comparten:

| Consumidor | Uso |
|---|---|
| `modules/products/components/TabInventory.tsx:400-426` | Pinta la lista con su propio "Anterior"/"Siguiente" suponiendo una página de 10 |
| `modules/products/store/products.store.ts:234,340,408,432,445` | `addToInventory`, `saveMedicine` (upsert optimista), `deleteMedicine`, `decrementStock`, `applyInventoryUpdate` |
| `modules/marketplace/hooks/useMarketplace.ts:102` | Lee `inventory` para validar stock de pedidos |
| `modules/marketplace/providers/MqttOrdersProvider.tsx` (5 lecturas) | Valida/reserva stock |

Por eso **no** se puede acumular sobre `inventory`: `TabInventory` la pintaría con paginación
de 10 y las mutaciones optimistas pasarían a operar sobre un array mucho más grande del que
asumen.

## Decisión

Slice independiente dentro de `useProductsStore`. `inventory` queda intacto.

Se descarta también la alternativa de `useInfiniteQuery` (precedente en
`modules/orders/hooks/useOrders.ts:71-83`) porque el módulo Productos mueve su inventario por
MQTT de forma optimista sobre el store: introducir react-query crearía dos fuentes de verdad
para el mismo dato.

## Diseño

### Slice en el store

```ts
export const SEARCH_FEED_PAGE_SIZE = 20;

searchFeed: {
  items: Medication[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;      // primera sección: reemplaza la lista
  isLoadingMore: boolean;  // secciones siguientes: agrega
  error: string | null;
  query: string;
  stockFilter: "in" | "out" | null;
}

searchFeedLoad:  (opts: { query: string; stockFilter: "in" | "out" | null }) => Promise<void>
searchFeedNext:  () => Promise<void>
searchFeedReset: () => void
```

- `searchFeedLoad` pide la primera sección a `productsService.getCursorInventory` con
  `{ limit: 20, query, stockFilter }` (sin cursor) y guarda `nextCursor`/`hasMore`.
  Ante fallo: lista vacía + `error`.
- `searchFeedNext` no hace nada si `!hasMore || isLoading || isLoadingMore || !nextCursor`.
  Pide `{ limit: 20, cursor: nextCursor }` y **agrega** (`items: [...prev, ...res.medications]`,
  deduplicando por `barCode` para no repetir filas ni claves de React). Ante fallo
  **conserva** los items ya cargados, setea `error` y deja `hasMore: true` para que el
  reintento manual funcione.
- **Guard de secuencia** en el closure del store: cada `searchFeedLoad` incrementa un contador y
  descarta respuestas obsoletas. Sin esto, el debounce de 300 ms puede pintar resultados de una
  búsqueda anterior. Es el patrón de `ProductSearchBar.tsx:30` (`searchSeqRef`), trasladado al
  store.
- Paginación por `next_cursor` y no por offset: inmune a drift cuando el stock cambia entre
  requests mientras se vende. Si el backend devuelve `has_more: true` sin `next_cursor`, se
  trata como fin de lista, para no loopear.
- `searchFeedReset` limpia el slice; la modal lo llama al cerrarse.

### La modal

`ProductSearchDialog.tsx`:

- Lee `searchFeed` + las 3 acciones, en vez de `inventory/hasMore/page/setPage/searchInventory`.
- El filtro de existencia pasa a estado local del componente; los botones disparan
  `searchFeedLoad` por el efecto de debounce existente (300 ms).
- Se **elimina** el footer completo (líneas 148-168): sin "Página N", sin "Anterior", sin
  "Siguiente".
- **Disparador**: `IntersectionObserver` sobre un sentinel al final del `<tbody>`, con
  `root: scrollRef.current` y `rootMargin: "200px"`. Requiere un `ref` nuevo en el contenedor de
  scroll de la línea 97, que hoy no tiene ninguno. El `rootMargin` hace que la carga empiece
  antes del borde, así que la lista crece sin pausa perceptible.
  - Consecuencia deseable: si 20 filas no llenan el alto de la modal, el sentinel ya queda
    visible y sigue cargando solo hasta que el contenedor desborde. Sin casos especiales.
- Fila spinner al final de la tabla cuando `isLoadingMore` (patrón `animate-spin` de
  `cash-register/index.tsx:41`).
- Fila de error con botón "Reintentar" cuando `error && items.length > 0`.
- El estado vacío pasa a `searchFeed.items.length === 0` con los mismos tres mensajes.

**Sin cambios**: overlay, input con `autoFocus`, `formatPrice`, `handleSelect`, columnas,
estilos de los filtros.

### Efecto lateral

La modal deja de llamar `setStockFilter`, así que el filtro de existencia ya no pisa el del
módulo Productos (hoy al tocar "Sin stock" en la modal se recarga el inventario de Productos
en background) y se borra el cleanup `setStockFilter(null)` de las líneas 42-46.

## Casos borde

| Caso | Comportamiento |
|---|---|
| Sin `pharmacyId` | `items: []`, `isLoading: false`, sin request (espejo de `loadPage:78-81`) |
| Escritura rápida | El guard de secuencia descarta la respuesta vieja |
| Cambio de filtro de existencia | `searchFeedLoad` reemplaza la lista; el sentinel vuelve a disparar |
| `hasMore: false` | El sentinel no dispara nada; no se muestra mensaje de fin |
| Doble disparo del sentinel | `isLoadingMore` bloquea el segundo |
| Cierre con una sección en vuelo | `searchFeedReset` incrementa la generación, así que la respuesta tardía se descarta y no repuebla el feed tras cerrar |
| Producto sin `barCode` | El dedupe de append usa la misma clave de fallback que la `key` de la tabla |

## Tests

En `test/products-store.test.mjs` (harness existente: loader de alias, `productsService`
mockeable, auth store real). `resetStores()` debe incluir el campo `searchFeed` o el estado
filtra entre tests.

1. `searchFeedLoad` llena `items` y guarda `nextCursor`/`hasMore`.
2. `searchFeedNext` **agrega** (no reemplaza) y reenvía el `cursor` de la primera respuesta.
3. `searchFeedNext` es no-op si `hasMore: false`.
4. `searchFeedNext` fallido conserva `items`, setea `error` y deja `hasMore: true`.
5. Una respuesta obsoleta no pisa a la más reciente.
6. `searchFeedReset` limpia el slice.

## Verificación

- `npx tsc --noEmit`
- `npm run test:store`
- `npm run build`
- Manual: abrir la modal, scrollear y ver crecer la lista, recorrer los tres filtros de
  existencia (valida que el backend acepta `cursor` + `stock_filter` juntos, combinación sin
  verificar hoy en el repo), y probar el reintento con la red caída.

## Riesgo conocido

`cursor` + `stock_filter` no está verificado en el frontend. Los loops de cursor existentes
(`TabInventory.tsx:131-148`, `fetchCatalog`) usan `query` y `low_stock`; `ProductSearchBar` usa
`stock_filter` pero sin cursor. Si la combinación falla en el backend, el fallback es cambiar
`searchFeedNext` a `offset: items.length` (la ruta que `TabInventory` ya exercise con esos
mismos filtros).
