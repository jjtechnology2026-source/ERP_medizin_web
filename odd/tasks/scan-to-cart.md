# Escanear para vender — agregar productos al carrito desde el teléfono

Feature: `scan-to-cart`
Owner: parent session (el Gentleman)
Repo: `ERP_medizin_web`, module `cash-register`.

## Specs

**S1 — El pedido.** Del dueño (2026-11-23), verbatim:

> "quiero crear en el repo una función pero que solamente se habilite en la parte de la caja en cuando sea mobile que quiero que haga yo quiero que agarre que yo pueda agarrar y escanear con mi teléfono los códigos de barra y que como yo tengo el producto poder modificar poder agregarlo por ejemplo pum escaneé colocar la cantidad que se va a vender pum aceptar puedo volver a escanear y voy agregando me entiende para la venta que en vez de yo buscar los productos a mano también los puedo buscando escaneando escaneo coloco la cantidad pum continuo el siguiente escaneo pin y después yo me salgo y yo vea de ahí yo vea en la caja mira que se agregaron todos los productos para agregar y procesar colocar el método de pago colocar en la persona que se le va a hacer la venta y el método de pago me debe entender"

**S2 — Solo mobile.** "Pero quiero que solamente se active cuando sea móvil. No se vean de esto." El disparador vive en la `ActionBar` de la caja, que ya es `lg:hidden`: en escritorio no aparece nada nuevo y la composición actual no cambia.

**S3 — Escanear suma a la venta, no la reemplaza.** El flujo es acumulativo: escanear → cantidad → agregar → seguir escaneando. Al salir, el carrito tiene todos los productos y el cobro sigue siendo el de siempre (método de pago, cliente). No se duplica ni se reescribe la lógica del carrito ni la del cobro.

**S4 — Reusar el escáner que ya está probado.** El decodificado NO se reimplementa: se usa `modules/scanner` (hook `useBarcodeScanner`, `lookupScannedCode`, aceptación por simbología con verificador y doble lectura). El código que llega a la venta es el `barCode` guardado del producto resuelto, nunca el texto crudo decodificado.

**S5 — Cantidad explícita y acotada.** Se puede escribir la cantidad o usar − / +, con objetivos de 44×44. No se puede agregar más que el stock disponible ni una cantidad cero.

**S6 — Si el código no está, se dice y se sigue.** Un producto fuera del inventario de la sucursal muestra "código no encontrado" y la cámara sigue encendida: en el mostrador un fallo no puede costar cerrar y reabrir la pantalla.

## Lo que ya existe (no reimplementar)

- `modules/scanner/hooks/useBarcodeScanner.ts` — cámara, estados explícitos, cooldown, vibración, limpieza.
- `modules/scanner/lib/barcode-acceptance.ts` — simbologías con verificador, dígito GS1, puerta de estabilidad.
- `modules/scanner/lib/barcode-lookup.ts` — `lookupScannedCode` contra `getCursorInventory` con la escalera de reintentos.
- `modules/cash-register/store/current-order.store.ts` — carrito y `addMedication`.
- `components/ui/sheet` — superficie mobile (ya con `panelClassName`).

## Tasks

| ID | Tarea | Specs |
| --- | --- | --- |
| T1 | Componente `ScanToCartSheet`: cámara, producto resuelto con precio y stock, cantidad con −/número/+, "Agregar a la venta", feedback y reinicio para el siguiente escaneo | S3, S4, S5, S6 |
| T2 | Disparador en la `ActionBar` de caja, solo mobile, sin tocar la búsqueda manual que ya existe | S2 |
| T3 | Verificación: la cantidad respeta el stock y no admite 0; el carrito crece con cada escaneo; el cobro posterior funciona | S3, S5 |

Non-goals: cambiar el cobro, el cliente o el fiscal; escanear en escritorio; alta de productos nuevos al inventario.

## Log

**L1** (pedido original, verbatim): el texto de S1 + S2.

**L2** (estado previo): `/escaner` ya consulta precio y stock y ajusta inventario con permiso; el carrito y el cobro mobile están recompuestos desde `mobile-mara-responsive`. Esta feature suma el tercer uso del mismo decodificador.
