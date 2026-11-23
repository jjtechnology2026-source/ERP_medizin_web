# Producto: editar todos los campos de "Detalles"

Formulario de edición de producto (`StockFeaturesForm`, pestaña "Detalles") hoy solo permite cambiar el nombre; el resto se muestra como texto estático. Objetivo: poder modificar cualquier campo del producto desde ahí.

## Specs

- **S1** (pedido original): "en el erpweb, cuando le das modificar un producto esta la parte de detllaes donde solo modificas el nombre, abre ese formulario completo para que puedan modificar cualquier campo porfa"
- **S2**: `barCode` y `productType` quedan de solo lectura. `barCode` es la identidad del producto en `products`, `pharmacy_inventory`, lotes y ventas, y no existe endpoint de renombre. `productType` solo se puede cambiar por `POST /Medications/Create` (upsert), fuera de alcance.
- **S3**: un solo botón "Guardar cambios" en la pestaña Detalles que persista todos los campos de la pestaña, incluido el nombre. Se retira el botón "Guardar nombre".
- **S4**: el campo `image` no se edita en este cambio (queda como está, sin control de subida).
- **S5**: cada guardado envía el payload **completo** de `ProductUpdateDto` (13 claves: `barCode`, `activeIngredient`, `antibiotic`, `brand`, `category`, `controlled`, `description`, `dosage`, `image`, `name`, `subcategory`, `tablets`, `vat`). El backend mapea con `unwrap_or_default()` (`Backend-administrativo/src/features/products/src/adapters/mappers.rs:32-49`), así que una clave omitida **borra** la columna guardada.
- **S6**: los campos que el tipo de producto oculta (`productTypeRules`, `modules/products/lib/catalog.ts:46-118`) no se renderizan y conservan su valor guardado en el payload; no se limpian.

Fuera de alcance: precio/stock/IVA/lote/vencimiento (ya editables en la pestaña "Precio, IVA y Stock"), imagen, `productType`, `barCode`.

## Tasks

| ID | Specs | Qué hace | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S5 | `productsService.updateProduct` → `PUT /admin/products/update` con el payload completo | `modules/products/api/products.service.ts` | 1 |
| T2 | S1,S5 | `updateMedicineDetails` en el store: resuelve el producto desde el server, mergea ediciones y envía el payload completo; actualiza `inventory`/`catalog`/`currentMedicine` | `modules/products/store/products.store.ts` + `test/products-store.test.mjs` | 1 |
| T3 | S1,S2,S3,S4,S6 | Pestaña "Detalles" editable: nombre, marca, principio activo, presentación, dosis, categoría, subcategoría, descripción, controlado, antibiótico. `barCode`/`productType` de solo lectura. Un botón "Guardar cambios" | `modules/products/components/StockFeaturesForm.tsx` | 2 |
| T4 | S5 | Verificación: `test:store`, `test:catalog`, `lint`, `build` | — | 2 |

## Log

- **L1**: "sabes que en el erpweb, cuando le das modificar un producto esta la parte de detllaes donde solo modificas el nombre, abre ese formulario completo para que puedan modificar cualquier campo porfa"
- **L2**: "si es ese, en la parte de editar producto esta dettales del producto alli es" — confirma el repo `/Users/medizinapp/ERP_medizin_web` y la pestaña "Detalles" como el lugar exacto.
- **L3**: Decisiones del humano: `barCode` y `productType` de solo lectura; un solo botón "Guardar cambios"; sin control de imagen.
- **L4**: `PUT /admin/products/update` ya existe en el backend y el frontend nunca lo llamaba. `ProductUpdateDto` no incluye `productType`.
- **L5**: Implementado. `934913f` (T1+T2: servicio, store y tests), `cc071af` (T3: pestaña Detalles editable + `CATEGORY_MAP` compartido + este documento). Checks: `test:store` 25/25, `test:catalog` 5/5, `tsc --noEmit` limpio, `next build` OK, eslint sin problemas nuevos en los archivos tocados.
