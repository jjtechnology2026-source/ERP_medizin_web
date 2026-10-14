# Catálogo dinámico de categorías y subcategorías en "Crear Producto"

Fecha: 2026-10-08
Estado: aprobado

## Problema

En el ERP (`ERP_medizin_web`, Next.js 16, React 19, pnpm, `@tanstack/react-query` + axios), la vista "Crear Producto"
(`modules/products/components/TabCreateProduct.tsx`) tiene categorías y subcategorías **hardcodeadas** en la constante
`CATEGORY_MAP` (líneas 17-24), consumida en el select de categoría (línea 544), el de subcategoría (línea 552) y en el
derivado `subcategoryOptions` (línea 329).

El backend (`Backend-administrativo`) ahora expone dos endpoints de catálogo maestro:

- `GET /admin/products/categories` → `{ "categories": string[] }`
- `GET /admin/products/subcategories?category=<nombre exacto>` → `{ "category": string, "subcategories": string[] }`
  (400 si `category` vacío; categoría desconocida → lista vacía)

Estos son la fuente de verdad correcta para los selects.

## Objetivo

Que los selects de categoría y subcategoría de la sección "Crear Producto" se carguen desde el backend, conservando el
**mapa hardcodeado solo como respaldo** cuando la API no responde (red caída, sesión expirada, error 5xx). El payload de
creación de producto no cambia: `category` y `subcategory` siguen viajando como strings planos.

## Enfoque elegido

React Query vía `useApiQuery` (hook genérico del core, `modules/core/hooks/useApi.ts`) con métodos de servicio en
`modules/products/api/products.service.ts`. Es el patrón existente del módulo (p. ej. `StockAutocomplete.tsx`).

## Cambios

### 1. `modules/products/api/products.service.ts`

Agregar dos métodos a `productsService`:

- `getProductCategories(): Promise<string[]>` →
  `api.get("/admin/products/categories")` → return `data.categories`
- `getProductSubcategories(category: string): Promise<string[]>` →
  `api.get("/admin/products/subcategories", { params: { category } })` → return `data.subcategories`

El interceptor de `modules/core/api/client.ts` ya convierte toda llamada a `POST /api/proxy` con `{ url, method, params }`
y adjunta el Bearer token; el proxy resuelve la base URL desde `NEXT_PUBLIC_API_URL`. No hay cambios allí.

### 2. `modules/products/components/TabCreateProduct.tsx`

Solo la parte de los selects (líneas 329, 538-555). Agregar:

```tsx
const { data: fetchedCategories } = useApiQuery<string[]>(
  ["products", "categories"],
  "/admin/products/categories",
  { staleTime: 5 * 60 * 1000 }
);

const { data: fetchedSubcategories } = useApiQuery<{
  category: string;
  subcategories: string[];
}>(
  ["products", "subcategories", formData.category],
  "/admin/products/subcategories",
  { params: { category: formData.category }, enabled: !!formData.category, staleTime: 5 * 60 * 1000 }
);
```

Derivar las opciones con respaldo:

```tsx
const categoryOptions = fetchedCategories ?? CATEGORY_KEYS;
const subcategoryOptions =
  fetchedSubcategories?.subcategories ?? (CATEGORY_MAP[formData.category] ?? []);
```

Regla del respaldo: los datos de la API **primero** (aunque la lista venga vacía = verdad del catálogo); el `CATEGORY_MAP`
solo se usa mientras la query no ha entregado datos (loading/error). Así una subcategoría legítimamente vacía no se
"rellena" con valores falsos del mapa.

- `SearchableSelect` no cambia (ya soporta buscar y "agregar custom" si el valor no está en la lista).
- El `onChange` de categoría sigue reseteando `subcategory` a `""`.
- La plantilla Excel de ejemplo (líneas 142-162) se deja como está (dummy data, fuera de alcance).
- `CATEGORY_MAP` y `CATEGORY_KEYS` se conservan como respaldo (no se eliminan).

## Comportamiento resultante

| Situación | Categorías | Subcategorías |
|---|---|---|
| API responde | Lista del backend | Lista del backend para la categoría elegida |
| API falla / no responde aún | Respaldo `CATEGORY_KEYS` | Respaldo `CATEGORY_MAP[category]` |
| Categoría sin subcategorías (backend, liga vacía) | — | Lista vacía (verdad del catálogo, sin fallback) |

## Seguridad

- Sin cambios de seguridad: las llamadas pasan por el interceptor existente con Bearer token y las rutas `/admin/*` ya
  exigen JWT + rol (`admin|agent`) en el backend.

## Verificación

- `pnpm tsc` / `pnpm build` del front sin errores.
- Prueba manual contra la API real: los selects de "Crear Producto" muestran 6 categorías y las subcategorías correctas
  de `CATEGORY_MAP` del backend (que ya vive en la base) al elegir cada una.
- Si no hay UI de test en el repo, validar tipos + build y el flujo con el backend en vivo.

## Alcance / no-alcance

- Incluye: selects de la sección "Crear Producto" (categoría + subcategoría), service, respaldo, cache de 5 min.
- Excluye: plantilla Excel, importación masiva, edición de producto, otros tabs, agregar categorías desde UI.