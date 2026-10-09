# Catálogo dinámico de categorías/subcategorías en "Crear Producto" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los selects de categoría y subcategoría de la sección "Crear Producto" se carguen desde `GET /admin/products/categories` y `GET /admin/products/subcategories?category=...`, con el `CATEGORY_MAP` hardcodeado solo como respaldo cuando la API no responde.

**Architecture:** Next.js 16 / React 19. La llamada se hace con el hook genérico del core `useApiQuery` (React Query + axios vía `/api/proxy`, con Bearer token), que es el patrón ya usado en `statistics`, `audit` y `FilterGeneral`. La regla "API primero; respaldo solo si aún no hay datos" se extrae a funciones puras en `modules/products/lib/catalog.ts` para poder testearla con el runner `node --test` que ya usa el repo (`test:pricing`, `test:store`).

**Tech Stack:** TypeScript, React 19, `@tanstack/react-query` 5, axios, `node --test` con `--experimental-strip-types`, eslint (next), pnpm.

## Global Constraints

- Repo: `C:\medizin\ERP_medizin_web` (rama `master`). Package manager: **pnpm**.
- No tocar `SearchableSelect`, ni el payload de creación del producto (`category`/`subcategory` siguen como strings planos).
- `CATEGORY_MAP` y `CATEGORY_KEYS` (líneas 17-26 de `TabCreateProduct.tsx`) **se conservan** como respaldo; no se eliminan.
- La plantilla Excel de ejemplo (líneas 142-162 de `TabCreateProduct.tsx`) **no se toca**.
- Regla de respaldo (verbatim del spec): usar datos de la API cuando llegaron (aunque la lista venga vacía), y el mapa hardcodeado solo mientras la query no ha entregado datos (loading/error).
- Endpoints reales (respuesta verificada en `src/features/products/src/adapters/present.rs`): `GET /admin/products/categories` → `{ "categories": string[] }`; `GET /admin/products/subcategories?category=<nombre>` → `{ "category": string, "subcategories": string[] }` (400 si `category` vacío; categoría desconocida → lista vacía).
- Sin cambios en `modules/core/api/client.ts` (el interceptor ya convierte todo a `POST /api/proxy` con `{ url, method, params }` y adjunta el token).

> **Nota de reconciliación con el spec:** el spec listaba además métodos `getProductCategories`/`getProductSubcategories` en `products.service.ts`. Se descartan: `useApiQuery` ya encapsula la llamada por endpoint (los otros consumidores del repo lo usan así), y esos métodos quedarían sin uso. Se preserva el resto del spec (React Query, cache, regla de respaldo, alcance).

---

### Task 1: Funciones puras de respaldo + test

**Files:**
- Create: `modules/products/lib/catalog.ts`
- Test: `test/catalog.test.mjs`
- Modify: `package.json` (agregar script `test:catalog`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `resolveCategoryOptions(fetched: string[] | undefined, fallback: string[]): string[]`
  - `resolveSubcategoryOptions(fetched: { category: string; subcategories: string[] } | undefined, fallback: string[]): string[]`

- [x] **Step 1: Escribir el test que falla**

Crear `test/catalog.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { resolveCategoryOptions, resolveSubcategoryOptions } from "../modules/products/lib/catalog.ts";

test("categorias: usa la lista de la API cuando llego (incluso vacia)", () => {
  assert.deepEqual(resolveCategoryOptions(["A", "B"], ["X"]), ["A", "B"]);
  assert.deepEqual(resolveCategoryOptions([], ["X"]), []);
});

test("categorias: cae al respaldo solo si la query no entrego datos", () => {
  assert.deepEqual(resolveCategoryOptions(undefined, ["X", "Y"]), ["X", "Y"]);
});

test("subcategorias: usa la lista de la API de la categoria elegida", () => {
  assert.deepEqual(
    resolveSubcategoryOptions({ category: "Higiene", subcategories: ["Jabones"] }, ["Fallback"]),
    ["Jabones"],
  );
});

test("subcategorias: respeta la liga vacia del backend (no rellena con el respaldo)", () => {
  assert.deepEqual(
    resolveSubcategoryOptions({ category: "Ampollas", subcategories: [] }, ["Otros"]),
    [],
  );
});

test("subcategorias: cae al respaldo mientras carga o si fallo la query", () => {
  assert.deepEqual(resolveSubcategoryOptions(undefined, ["Jabones", "Otros"]), ["Jabones", "Otros"]);
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `node --experimental-strip-types --test test/catalog.test.mjs`
Expected: FAIL — `Cannot find module '.../modules/products/lib/catalog.ts'`.

- [x] **Step 3: Crear el módulo mínimo**

Crear `modules/products/lib/catalog.ts`:

```typescript
export interface SubcategoriesResponse {
  category: string;
  subcategories: string[];
}

export function resolveCategoryOptions(
  fetched: string[] | undefined,
  fallback: string[],
): string[] {
  return fetched ?? fallback;
}

export function resolveSubcategoryOptions(
  fetched: SubcategoriesResponse | undefined,
  fallback: string[],
): string[] {
  return fetched?.subcategories ?? fallback;
}
```

- [x] **Step 4: Correr el test y verificar que pasa**

Run: `node --experimental-strip-types --test test/catalog.test.mjs`
Expected: PASS — 5 tests, 0 fallos.

- [x] **Step 5: Registrar el script en `package.json`**

En el bloque `scripts`, después de `"test:store": ...`, agregar:

```json
"test:catalog": "node --experimental-strip-types --test test/catalog.test.mjs"
```

- [x] **Step 6: Correr vía pnpm**

Run: `pnpm test:catalog`
Expected: PASS — 5 tests, 0 fallos.

- [x] **Step 7: Commit**

```bash
git add modules/products/lib/catalog.ts test/catalog.test.mjs package.json
git commit -m "feat(products): resolucion pura de opciones de categoria con respaldo"
```

---

### Task 2: Conectar los selects del formulario a la API

**Files:**
- Modify: `modules/products/components/TabCreateProduct.tsx` (imports línea 1-7; `subcategoryOptions` línea 329; `SearchableSelect` de categoría líneas 539-546; de subcategoría líneas 547-554)

**Interfaces:**
- Consumes: `useApiQuery<T>(key, endpoint, options)` de `@/modules/core/hooks/useApi`; `resolveCategoryOptions` / `resolveSubcategoryOptions` de `@/modules/products/lib/catalog`.
- Produces: nada nuevo hacia otros módulos (cambio local del componente).

- [x] **Step 1: Agregar imports**

Tras la línea de import de `useAuthStore` (o junto a los imports existentes), agregar:

```tsx
import { useApiQuery } from "@/modules/core/hooks/useApi";
import { resolveCategoryOptions, resolveSubcategoryOptions } from "@/modules/products/lib/catalog";
```

- [x] **Step 2: Agregar las dos queries**

Justo después de `const subcategoryOptions = CATEGORY_MAP[formData.category] || [];` (línea 329), **reemplazar** esa línea por:

```tsx
const { data: categoriesResponse } = useApiQuery<{ categories: string[] }>(
  ["products", "categories"],
  "/admin/products/categories",
  { staleTime: 5 * 60 * 1000 },
);

const { data: subcategoriesResponse } = useApiQuery<{
  category: string;
  subcategories: string[];
}>(
  ["products", "subcategories", formData.category],
  "/admin/products/subcategories",
  {
    params: { category: formData.category },
    enabled: !!formData.category,
    staleTime: 5 * 60 * 1000,
  },
);

const categoryOptions = resolveCategoryOptions(categoriesResponse?.categories, CATEGORY_KEYS);
const subcategoryOptions = resolveSubcategoryOptions(
  subcategoriesResponse,
  CATEGORY_MAP[formData.category] ?? [],
);
```

- [x] **Step 3: Usar `categoryOptions` en el select de categoría**

En el `SearchableSelect` de categoría (líneas ~539-546), cambiar:

```tsx
options={CATEGORY_KEYS}
```

por:

```tsx
options={categoryOptions}
```

(No cambiar `label`, `placeholder`, `required`, `value` ni el `onChange`.)

- [x] **Step 4: Usar `subcategoryOptions` en el select de subcategoría**

El select de subcategoría (líneas ~547-554) ya usa `options={subcategoryOptions}`; con el Step 2 ahora `subcategoryOptions` es la versión reactiva. No requiere más cambios, pero **verificar que sigue presente**:

```tsx
options={subcategoryOptions}
```

- [x] **Step 5: Lint**

Run: `pnpm lint`
Expected: sin errores nuevos en `modules/products/components/TabCreateProduct.tsx` ni `modules/products/lib/catalog.ts`. (Los warnings preexistentes de otros archivos no son de este cambio.)

- [x] **Step 6: Build (typecheck + compilación)**

Run: `pnpm build`
Expected: `Compiled successfully` (Next.js). Si falla por tipado, corregir los tipos de las respuestas (`categoriesResponse?.categories`, `subcategoriesResponse?.subcategories`) hasta compilar.

- [x] **Step 7: Commit**

```bash
git add modules/products/components/TabCreateProduct.tsx
git commit -m "feat(products): categorias y subcategorias dinamicas en crear producto"
```

---

### Task 3: Verificación en vivo contra el backend

**Files:** ninguno (verificación).

- [ ] **Step 1: Verificar los endpoints reales**

Run (con el token de sesión del ERP; en su defecto, contra el dominio de la API):

```bash
curl -s -H "Authorization: Bearer <TOKEN>" https://medizins.com/admin/products/categories
curl -s -H "Authorization: Bearer <TOKEN>" "https://medizins.com/admin/products/subcategories?category=Higiene"
```

Expected: `{"categories":["Ampollas","Bebé","Higiene","Insumos","Medicamentos","Otros"]}` y `{"category":"Higiene","subcategories":["Afeitado","Cuidado Capilar","Cuidado Oral","Desodorantes","Jabones","Otros"]}` (ordenados).

- [ ] **Step 2: Probar el formulario**

Run: `pnpm dev`, abrir **Productos → Crear Producto**.
Expected:
- El select "Categoría" muestra las 6 categorías del catálogo.
- Al elegir una categoría, "Subcategoría" muestra las de la API para esa categoría (p. ej. "Higiene" → las 6 anteriores).
- Si se usa una categoría sin subcategorías, el select queda vacío (no muestra valores del respaldo).
- La consola de red muestra `POST /api/proxy` con destino `/admin/products/categories` y `/admin/products/subcategories`.

- [ ] **Step 3: Probar el respaldo**

En DevTools, bloquear las requests a `/admin/products/*` (u offline) y recargar la vista.
Expected: los selects siguen mostrando los valores del `CATEGORY_MAP` (respaldo) y el formulario no se rompe.

---

## Self-Review

- **Cobertura del spec:** endpoints → Task 2 (Step 2) y Task 3; respaldo ante fallo → Task 1 (funciones puras) + Task 2; cache 5 min → Task 2; sin cambios de payload/`SearchableSelect` → constraints + Task 2 Steps 3-4; plantilla Excel intacta → constraints; verificación (tipos+build+en vivo) → Task 2 Step 6 y Task 3. Solo se descartó el "Archivo 1" (service) por redundancia, documentado arriba.
- **Placeholders:** ninguno; cada step tiene código o comando exacto.
- **Consistencia de tipos:** `categoryOptions: string[]`, `subcategoryOptions: string[]`; `resolveSubcategoryOptions` recibe `{ category, subcategories } | undefined`, que es lo que devuelve `useApiQuery` (envelope del backend). Coincide con `SubcategoriesResponse`.

---

## Estado de verificación (2026-10-09)

- **Task 1 y 2 ejecutadas y verificadas:** `npm run test:catalog` → 5/5 pass; `npm run lint` → sin errores nuevos en `catalog.ts` ni en las líneas tocadas de `TabCreateProduct.tsx` (los problemas reportados en otros archivos/líneas son preexistentes); `npm run build` → `Compiled successfully` + TypeScript OK.
- **Nota:** el plan menciona pnpm, pero en esta máquina pnpm está roto por un mismatch de llaves de corepack; se verificó con npm (mismos scripts).
- **Task 3 (verificación en vivo) pendiente:** en curso por el usuario contra `https://medizins.com` (curl con token + prueba del formulario + prueba de respaldo).
