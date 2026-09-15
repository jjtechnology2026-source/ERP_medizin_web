# Diseño: Editar nombre de producto desde la vista de edición

Fecha: 2026-09-15

## Contexto

En la vista de edición (`StockFeaturesForm`, vista `STOCK_FEATURES`), el nombre del
producto es solo lectura: la pestaña "Detalles" lo muestra como texto en
`modules/products/components/StockFeaturesForm.tsx:364`. El usuario necesita poder
editar el nombre sin tocar el resto de campos.

Existe un endpoint del backend dedicado:

- `PUT /admin/products/update-name`
- Auth: JWT obligatorio, rol `admin`.
- Body: `{ "barCode": "...", "name": "Nuevo Nombre" }`
- Respuesta: `{ "barCode": "...", "name": "Nuevo Nombre" }`
- Valida nombre en blanco (`name cannot be empty`).
- Actualiza `name` y reconstruye `search_document` (y embedding si hay
  `EmbeddingClient`) sin blanquear el resto de campos del producto.

## Objetivo

Permitir cambiar el nombre de un producto existente desde la pestaña "Detalles"
de la vista de edición, usando el endpoint `PUT /admin/products/update-name`.

## Enfoque

Enfoque A (aprobado): acción centralizada en el store + campo editable en la
pestaña "Detalles" con botón "Guardar nombre".

## Cambios

### 1. `modules/products/api/products.service.ts`
Añadir método al service:

```ts
async updateName(barCode: string, name: string): Promise<void> {
  await api.put("/admin/products/update-name", { barCode, name });
}
```

El cliente API (`modules/core/api/client.ts`) ya convierte `PUT` a
`POST /api/proxy` con `method: "PUT"`, así que no requiere cambios en el proxy.

### 2. `modules/products/store/products.store.ts`
Añadir acción `updateMedicineName(barCode: string, name: string): Promise<boolean>`:

1. Llama a `productsService.updateName(barCode, name)`.
2. En éxito:
   - Actualiza `name` en `currentMedicine` si coincide el `barCode`.
   - Actualiza `name` en items de `inventory` y `catalog` cuyo `barCode` coincida.
   - Llama `fetchInventory(true)` para recargar la página actual de inventario.
3. Retorna `true` en éxito, `false` en error (con `console.error`).

### 3. `modules/products/components/StockFeaturesForm.tsx`
En la pestaña "Detalles", el bloque "Nombre comercial" (hoy `:361-365`, texto
estático) pasa a:

- Estado local `nameDraft` inicializado desde `currentMedicine?.name` (via
  `useEffect`/`setState` junto al existente de `:36`).
- `<input>` editable para el nombre.
- Botón "Guardar nombre" junto al campo:
  - Deshabilitado si `nameDraft` está vacío o igual al nombre actual.
  - `isSavingName` para spinner/deshabilitado mientras guarda.
  - Feedback éxito/error con el patrón de `feedback` existente del componente.
- En éxito, el header del producto (`:159-161`) se actualiza automáticamente
  porque lee `currentMedicine.name` del store.

## Comportamiento al guardar

- El resto de los campos del producto no se tocan.
- `search_document` y embedding se regeneran en el backend.
- La página actual de inventario se recarga para reflejar el nombre en listas.
- El catálogo en memoria se actualiza sin recargar las 10 páginas de 5000.

## Errores

- Nombre vacío: se valida en la UI (botón deshabilitado) y el backend responde
  `name cannot be empty` si llegara.
- Error del backend: se muestra el feedback de error existente.

## Pruebas

Mínimas por solicitud del usuario:
- `npm run build` para verificar compilación.
- Verificación manual del flujo (editar nombre, ver header actualizado,
  recarga de inventario).
- Sin tests unitarios nuevos.