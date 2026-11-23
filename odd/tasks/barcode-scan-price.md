# Escáner de códigos de barra — consulta de precio y stock desde el celular

Feature: `barcode-scan-price`
Owner: parent session (el Gentleman)
Repo: `ERP_medizin_web` (Next.js 16.1.5, App Router). Backend: `Backend-administrativo` (no se toca en esta rebanada).

## Specs

**S1 — Alcance de esta rebanada.** Pedido del dueño (2026-11-23, sesión Pi):

> "Ve, vamos a saltarnos esto. Vamos a hacer la función que me pidió Yirkin aquí en el RP para escanear los códigos de barra y ver los precios. Vamos a planificar eso."

Decisiones tomadas en la misma sesión:

- App: `ERP_medizin_web` (este repo, caja/POS).
- Alcance: "Solo consultar: precio y stock".
- Hardware: "Cámara del celular".
- Decodificación: "Agregar zxing-wasm".
- Ubicación: "Pantalla nueva /escaner".

**S2 — Lo que Jir pidió de más, y queda fuera.** Mensajes de Jir por WhatsApp (2026-11-23 20:45–20:47, -04):

> "De qué en el celular se pueda escanear el código de barra en el celular en el erp, para modificar inventario"

> "Para que puedan hacer inventario desde el celular"

Jir pidió **escribir inventario**. Esta rebanada es **solo lectura** porque escribir stock es un cambio de datos sobre una farmacia en producción (riesgo alto, item 1) y merece su propia transacción, su propia verificación contra el invertario real y su propio rollback. Decisión explícita del dueño: primero consulta, después escritura.

**S3 — Nunca resolver un producto que no corresponde.** El escaneo matchea **exacto** contra `barCode`. Prohibido el fallback difuso. El defecto existe hoy en `modules/products/store/products.store.ts:407-410`:

```ts
page.medications.find(m => m.barCode === barCode) ?? page.medications[0]
```

Con tipeo manual casi no se dispara; con escáner sí (código de góndola, etiqueta rota, producto de otra cadena) y termina en **venta del producto equivocado al precio equivocado**. La pantalla nueva no reusa esa función: si no hay match exacto, muestra "código no encontrado".

**S4 — De dónde sale el dato.** `getCursorInventory(pharmacyId, { query, limit })` → `GET /admin/Pharmacy/{pharmacyId}/medications/cursor` (`modules/products/api/products.service.ts:79,101`). Campos: `price` (final, con IVA), `stock`, `barCode`, `activeIngredient`, `presentation`. La consulta va scopeada a `profile.pharmacyId` (`modules/auth/store/useAuthStore.ts:20`), que es la única sucursal de la sesión — **no existe selector de sucursal** en este repo.

**S5 — Tiene que funcionar en el iPhone del mostrador.** La captura que mandó Jir es iOS Safari (barra inferior de Safari, teclado con corrector No/Y/Sí). Safari **no soporta `BarcodeDetector`**, así que la decodificación no puede depender de la API nativa del navegador: se usa `zxing-wasm`. Debe funcionar también en Chrome Android.

**S6 — La cámara exige contexto seguro y permiso.** `getUserMedia` solo existe en HTTPS (o `localhost`). La pantalla muestra un estado explícito y accionable para: permiso denegado, dispositivo sin cámara, contexto no seguro, y navegador sin soporte. Nunca un spinner infinito.

**S7 — Tolerancia de código, en este orden.** El backend normaliza ceros a la izquierda en `barCode` (ver `Backend-administrativo`: `normalize_barcode_leading_zeros`, migración `20260930_unique_product_barcode.surql`). Un EAN-13 escaneado puede corresponder a un UPC-A de 12 dígitos guardado. Orden de intentos, cada uno con match exacto: (1) código tal cual, (2) sin ceros a la izquierda, (3) rellenado a 13. Si ninguno matchea: "código no encontrado". Nunca se acepta un resultado parcial.

**S8 — Exclusiva de mobile, no existe en desktop.** Requisito del dueño (2026-11-23): la función aparece **solo** en el celular. Concretamente:

- El ítem de menú **no se renderiza en desktop**. El shell ya corta en `lg` (`components/ui/layout/index.tsx:83-101`): el ítem vive en el drawer mobile, no en la barra lateral grande.
- La ruta `/escaner` está **guardada por viewport**: si se abre en desktop (por URL, marcador o historial) muestra un aviso claro de que la función es solo para celular, y no monta la cámara.
- Nada de este cambio altera el layout ni el menú de desktop para el resto de las pantallas.

Definición operativa de "mobile": viewport < 1024px (`max-width: 1023px`), el mismo breakpoint `lg` que ya usa el shell. Se evalúa con `matchMedia`, no con user-agent (el user-agent miente y rompe en tablets y en devtools).

## Tasks

| ID | Tarea | Specs | Ruta |
| --- | --- | --- | --- |
| T1 | `resolveExactBarcode()` puro + tests primero (exacto, sin match, 12 vs 13 dígitos, y el caso que hoy devuelve el producto equivocado) | S3, S7 | inline |
| T2 | Dependencia `zxing-wasm` + hook `useBarcodeScanner` (permiso, stream, loop, cooldown, cleanup) | S5, S6 | worker |
| T3 | Pantalla `/escaner` **mobile-only**: ítem de menú solo bajo `lg`, guard de viewport en la ruta, cámara nunca se monta en desktop | S1, S8 | worker |
| T4 | Lookup contra `getCursorInventory` con los 3 reintentos de S7 y estados de error de S6 | S4, S6, S7 | worker |
| T5 | Tarjeta de resultado reusando el render de `PriceCheckDialog` (nombre, presentación, precio, stock, stock bajo) | S1, S4 | inline |
| T6 | Verificación: build, tests, y prueba real en el celular con un código de la farmacia | S5, S6, S7 | inline |

Non-goals: ajustar stock, crear ventas, offline, PWA, selector de sucursal.

## Log

**L1** (pedido original, verbatim): "Ve, vamos a saltarnos esto. Vamos a hacer la función que me pidió Yirkin aquí en el RP para escanear los códigos de barra y ver los precios. Vamos a planificar eso."

**L2** (decisiones, verbatim de las opciones elegidas): app `ERP_medizin_web`; alcance "Solo consultar: precio y stock"; hardware "Cámara del celular"; librería "Agregar zxing-wasm"; ubicación "Pantalla nueva /escaner".

**L3** (pedido de Jir, verbatim de WhatsApp): "De qué en el celular se pueda escanear el código de barra en el celular en el erp, para modificar inventario" y "Para que puedan hacer inventario desde el celular". Se difiere la parte de escritura (S2).

**L4** (evidencia del mapa, 2026-11-23): `PriceCheckDialog.tsx:19` ya resuelve "consultar precio" (código → `findInventoryItem` → render). El fallback defectuoso está en `products.store.ts:407-410`. No hay ninguna dependencia ni código de cámara (`getUserMedia`, `BarcodeDetector`, zxing, quagga, jsQR) en el repo. Next 16.1.5. No es PWA: `public/sw.js` es un placeholder que nunca se registra. `menuConstants.tsx:29` define los ítems con `permit` obligatorio.

**L5** (pendiente heredado, 2026-11-23): el rename `Alemyr Farma Aloandra` → `Farma Aloandra` y `alondra` → `aloandra` en la DB de producción quedó **sin verificación independiente** (el dueño confirmó haber corrido el apply; el guard de política impidió al agente leer `.env` y Railway redacta valores). Ver `Backend-administrativo/scripts/migrations/20261123_rename_aloandra_preflight.surql`. Deuda abierta, no bloquea esta feature.

**L6** (cambio de requisito, verbatim): "Esa funcionalidad debe aparecer solamente en el mobile. Tete tú que está en mobile, nada más, no en desktop."

Impacto: se agrega **S8** (exclusiva de mobile, guard de viewport, menú solo bajo `lg`) y se reescribe **T3**. El resto de las tareas y specs no cambia. Definición de mobile fijada en `< 1024px` por `matchMedia`, alineada al breakpoint `lg` del shell.
