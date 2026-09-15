# Diseño: Autocomplete de productos en la barra de búsqueda de Caja

Fecha: 2026-09-15

## Contexto

En el módulo de caja (`modules/cash-register`), hay una barra de búsqueda
(`ProductSearchBar`) con modo escáner: escribe un código o nombre y presiona
"ENTER - Agregar" (o Enter) para agregar el match exacto al pedido. El botón
verde "Buscar" (en `ActionButtons`) abre `ProductSearchDialog`, un diálogo con
búsqueda server-side _live_ (debounce 300 ms) y tabla paginada.

El botón verde "Buscar" es redundante: su función (buscar en el endpoint al
escribir) debe vivir en la propia barra de búsqueda. El usuario decide que NO
se elimina ni el botón verde ni el diálogo; solo se agrega el autocomplete a la
barra.

## Objetivo

Al escribir en la barra de `ProductSearchBar` (ej. "acetami"), buscar de forma
reactiva en el endpoint correspondiente y mostrar un dropdown de coincidencias
para agregar el producto al pedido con un clic. El modo escáner exacto (Enter /
"ENTER - Agregar") se conserva intacto.

## Comportamiento actual (referencia)

- `ProductSearchBar.tsx`: input `barcode` + botón "ENTER - Agregar" →
  `handleAdd` → `findInventoryItem(code)` → `addMedication(med, 1)`. Sin debounce.
- `ProductSearchDialog.tsx`: debounce 300 ms sobre `query` → `searchInventory(query)`
  → `loadPage(1)` → `productsService.getCursorInventory` → GET
  `/admin/Pharmacy/{id}/medications/cursor?limit=10&query=...`.
- El endpoint correspondiente es él mismo: `getCursorInventory` (server-side).

## Enfoque

Enfoque A (aprobado): autocomplete con estado local en `ProductSearchBar`,
sin tocar el store compartido ni el diálogo.

## Cambios

### Único archivo: `modules/cash-register/components/ProductSearchBar.tsx`

1. **Imports nuevos**: `useEffect`, `productsService`
   (`@/modules/products/api/products.service`), `useAuthStore`
   (`@/modules/auth/store/useAuthStore`), `Medication`
   (`@/modules/products/types/products.types`). `useState`/`useRef` y
   `useCurrentOrderStore`/`useProductsStore` ya existen.

2. **Estado local nuevo**:
   - `results: Medication[]` — coincidencias del autocomplete.
   - `isSearching: boolean` — spinner mientras consulta.
   - `showDropdown: boolean` — controla visibilidad del dropdown.

3. **Debounce search (300 ms)** — `useEffect` sobre `barcode`:
   - Texto vacío → `setResults([])`, `setShowDropdown(false)`, retorna.
   - `barcode.trim().length < 2` → no consulta (limpia y cierra; el escáner
     exacto con Enter sigue funcionando para códigos cortos).
   - `setIsSearching(true)`, `setShowDropdown(true)`.
   - `pharmacyId = useAuthStore.getState().profile?.pharmacyId`; si no hay,
     retorna sin consultar.
   - `productsService.getCursorInventory(pharmacyId, { query: barcode.trim(), limit: 10 })`.
   - Éxito → `setResults(res.medications)`. Error → `setResults([])` (silencioso).
   - `setIsSearching(false)`.
   - Limpieza con `clearTimeout`.

4. **Dropdown** — contenedor absoluto debajo del input (`absolute top-full`,
   `z-50`, fondo blanco, lista vertical estilo UI existente):
   - Fila por resultado: nombre (bold), marca/principio activo y precio +
     stock (texto pequeño).
   - `onClick` → `addMedication(med, 1)` (sin validación de stock: los
     productos sin stock igual se agregan; la orden lo valida),
     `setBarcode("")`, cerrar dropdown, `inputRef.current?.focus()`.
   - Estado vacío con texto: "Sin resultados para «texto»".
   - Estado cargando: spinner pequeño o "Buscando…".
   - Oculto cuando `!showDropdown` o `results.length === 0` con texto vacío.

5. **Cierre del dropdown**:
   - `onBlur` del input con `setTimeout(..., 150)` para permitir el clic en el
     dropdown antes de cerrarlo (patrón estándar para autocompletes).

6. **Enter y "ENTER - Agregar" SIN cambios**: `handleAdd`/`handleKeyDown`
   siguen igual con `findInventoryItem` (escaneo exacto).

### Endpoint

Sin cambios: `GET /admin/Pharmacy/{id}/medications/cursor?limit=10&query=...`
vía `productsService.getCursorInventory`. Sin cambios en proxy ni backend.

### Sin eliminaciones

El botón verde "Buscar", `ProductSearchDialog`, `ActionButtons` y
`ProductSearchDialog.tsx` quedan intactos.

## Comportamiento esperado

- Escribo "acetami" → a los ~300 ms consulta el endpoint → dropdown muestra
  coincidencias → clic agrega 1 unidad al pedido.
- Pulse Enter o "ENTER - Agregar" → comportamiento de escáner exacto actual.
- Si escribo un código corto (ej. "12") → el dropdown no consulta, pero Enter
  sigue agregando el match exacto.

## Errores / Edge cases

- Endpoint falla → dropdown con "Sin resultados" (sin romper el flujo).
- Sin coincidencias → "Sin resultados para «texto»".
- Sin `pharmacyId` → no consulta (silencioso).
- Dropdown se cierra al hacer clic fuera (onBlur con delay) y al agregar.

## Pruebas

Mínimas por preferencia del usuario:
- `npx tsc --noEmit`
- `npm run build`
- Prueba manual: escribir "acetami", ver dropdown, clic agrega; Enter sigue
  agregando el match exacto; botón verde "Buscar" sigue abriendo el diálogo.
- Sin tests unitarios nuevos.