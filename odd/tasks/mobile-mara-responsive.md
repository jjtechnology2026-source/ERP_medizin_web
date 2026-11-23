# Mara en el celular — rediseño de la experiencia mobile

Feature: `mobile-mara-responsive`
Owner: parent session (el Gentleman)
Repo: `ERP_medizin_web` (Next.js 16.1.5, App Router, Tailwind v4, sin librería de UI).

## Specs

**S1 — El pedido.** Del dueño (2026-11-23), verbatim:

> "quiero que investigue en internet unas skills para mejorar mara en lo que sería este lo que sería la parte mobile el responsable mobile response móvil de mara es muy malo es muy muy muy muy muy malo entonces necesito que tú lo mejores drásticamente ese response de mara me tienes que ser excelente en móvil"

> "imagínate lo mejor tenemos muchos botones y podemos esos botones se entrar en un botón único necesitamos aplicar buenas prácticas que se utilizan ahorita en los responsivóvil en las aplicaciones móviles aplicar esos mismos patrones para que cuando estés en desktop se vea una cosa y cuando esté en mobile se vea de otra manera y sea muy mucho más fácil interactuar"

Dos cosas quedan fijadas ahí: **consolidar botones** en uno solo donde se pueda, y **divergencia deliberada entre desktop y mobile** — no "responsive pasivo" (encoger), sino dos composiciones distintas de la misma pantalla.

**S2 — Decisiones tomadas en la misma sesión.** Navegación: "Barra inferior + hub 'Más'". Orden: "Primero el shell, luego pantallas". Modales: "Sumar Radix / Headless UI".

**S3 — Blancos táctiles.** Meta 44×44 CSS px (confort: Apple HIG 44pt, WCAG 2.5.5 AAA). Piso 24×24 CSS px, que es lo que exige **WCAG 2.2 SC 2.5.8 (Target Size, Minimum)** — verificado en la fuente: `w3c/wcag/guidelines/sc/22/target-size-minimum.html`, *"The size of the target for pointer inputs is at least 24 by 24 CSS pixels"*. Ningún control baja de 24; los de uso frecuente van a 44.

**S4 — Desktop no se rompe.** Todo cambio mobile es aditivo. Una pantalla de escritorio que hoy funciona no puede cambiar de comportamiento, orden ni permisos. Es la condición de aceptación de cada rebanada, no una recomendación.

**S5 — Ninguna acción depende del hover.** Hoy `modules/facturas/components/FacturasTable.tsx:196` usa `opacity-0 group-hover:opacity-100`: en un teléfono esas acciones **no existen**. Toda acción de fila tiene que ser visible y tocable, o estar detrás de un control explícito (kebab / sheet).

**S6 — Consolidación de acciones.** Una pantalla mobile expone **una acción primaria**; el resto vive en un overflow o en un bottom sheet. Medido hoy en 390px: caja-ventas con **14 controles** visibles, productos con **10**, cierre-caja con **9** (más 3 controles por línea de carrito). El objetivo por pantalla es ≤ 1 acción primaria + 1 secundaria en superficie, y el resto a un toque.

**S7 — Tablas.** En mobile, una tabla de más de 4 columnas se vuelve **lista de tarjetas** con 3–4 campos de decisión (nombre, precio, stock, estado) y el resto detrás de un disclosure. Scroll horizontal solo como último recurso y con primera columna sticky. Hoy hay `min-w-[900px]` en facturas, `min-w-[1000px]` en órdenes y una tabla de 8 columnas sin `min-w` en productos.

**S8 — Viewport y teclado.** `viewport-fit=cover` en el meta (sin eso, `env()` devuelve 0), alturas con `dvh` y no `vh`, barras fijas con `padding-bottom: env(safe-area-inset-bottom)`, e inputs con `font-size: 16px` mínimo para que iOS no haga zoom al enfocar.

**S9 — Una primitiva por patrón.** Hoy hay **20 overlays `fixed inset-0` escritos a mano**, uno por módulo. Se reemplazan por componentes compartidos (Dialog/Sheet/Menu de Radix, con el look del repo) a medida que cada rebanada toca su pantalla. No se migran los 20 de una: se migra el que la rebanada usa.

## Evidencia de la auditoría (2026-11-23)

- Shell: drawer off-canvas bajo `lg` (`components/ui/layout/index.tsx:77-79`), ancho atado al colapso de desktop (`components/ui/sidebar/index.tsx:79`, `layout:19`) — tocar el botón del pie deja el drawer del teléfono en **80px** con los submenús inalcanzables (`sidebar:116`). Sin barra inferior. Sin título de sección en pantalla (`layout:55-57` solo setea `<title>`).
- Navbar mobile sobrecargado: logo 104px + hamburguesa + `<CurrencySwitch/>` completo (`components/ui/navbar/index.tsx:324`, `NavbarComponents.tsx:42-113`).
- `max-w-8xl` en `layout/index.tsx:92` **no está definido** en `app/globals.css` → el contenedor no tiene tope de ancho.
- Cero ramas `mobile` reales en `modules/`: 13 hits de `hidden md:` en todo el repo, 6 en `components/shared/dataTable/dataTable.tsx` que **ningún módulo importa**.
- Referencias positivas ya escritas en el repo, a promover: `dataTable.tsx:355` (lista de tarjetas con acción a ancho completo), `components/shared/modals/MultiStepModal.tsx:39-96` (mobile-first, header/footer sticky), `modules/marketplace/components/MarketplaceOrderModal.tsx:39-160`, y el panel de notificaciones que ya es un sheet (`NavbarComponents.tsx:141-147`).

## Tasks

| ID | Tarea | Specs |
| --- | --- | --- |
| T1 | **Shell mobile**: barra inferior (≤5 destinos), hub `/mas` con el resto, header con el título de la sección, navbar limpio (moneda a un chip), `viewport-fit=cover` + safe-area, arreglo del drawer de 80px, `max-w-8xl` real | S2, S3, S4, S8 |
| T2 | **Primitivas compartidas** con Radix: `Sheet` (bottom sheet), `ActionBar` (barra de acciones fija), `RecordCard`. Migrar el overlay de la pantalla que la rebanada toque | S3, S6, S9 |
| T3 | **caja-ventas**: carrito como lista de tarjetas, acciones consolidadas en ActionBar (primaria: cobrar), pago en pantalla completa, filtros de stock a un sheet | S5, S6, S7 |
| T4 | **productos**: tabla de 8 columnas → tarjetas, acciones de fila visibles, filtros y alta de producto a sheets/pasos | S5, S6, S7 |
| T5 | **facturas + registro-ordenes**: matar las acciones hover-only, fechas y filtros a un sheet, paginador compacto | S5, S6, S7 |
| T6 | **cierre-caja + panel**: inputs de conteo con teclado numérico correcto, desglose por método legible, stats a 2 columnas | S3, S8 |

Non-goals: rediseño visual de marca, modo offline, apps nativas, tocar el backend.

## Log

**L1** (pedido original, verbatim): "quiero que investigue en internet unas skills para mejorar mara en lo que sería este lo que sería la parte mobile el responsable mobile response móvil de mara es muy malo es muy muy muy muy muy malo entonces necesito que tú lo mejores drásticamente ese response de mara me tienes que ser excelente en móvil entonces no se busca por internet o va a buscar una skill que nos ayuden a hacer ese response y se vea bien imagínate lo mejor tenemos muchos botones y podemos esos botones se entrar en un botón único necesitamos aplicar buenas prácticas que se utilizan ahorita en los responsivóvil en las aplicaciones móviles aplicar esos mismos patrones para que cuando estés en desktop se vea una cosa y cuando esté en mobile se vea de otra manera y sea muy mucho más fácil interactuar con él con el sistema desde mi teléfono entonces necesito que tome en cuenta investigues primero para llegar a las mejores prácticas después aplicarlo"

**L2** (decisiones, verbatim de las opciones elegidas): "Barra inferior + hub 'Más'", "Primero el shell, luego pantallas", "Sumar Radix / Headless UI".

**L3** (estado de la investigación): el explorador de investigación **no tenía herramientas web** en su inventario, así que no abrió ninguna página: sus 52 reglas son conocimiento del modelo con URLs sin verificar. Lo que sí se verificó contra fuente primaria: WCAG 2.2 SC 2.5.8 exige **24×24 CSS px** (`w3c/wcag`, `target-size-minimum.html`). Las skills aplicables del entorno son `impeccable` (auditoría de interfaces) y `ui-styling` (patrones Tailwind); `ui-ux-pro-max` está scopeada a apps nativas y solo sirve su checklist de touch/safe-area.
