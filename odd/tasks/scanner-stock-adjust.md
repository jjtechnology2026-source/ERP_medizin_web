# Ajuste de stock desde el escáner, con permiso propio

Feature: `scanner-stock-adjust`
Owner: parent session (el Gentleman)
Repos: `ERP_medizin_web` (pantalla), `Backend-administrativo` (endpoint + autorización), `pharmacy-administrator-medizin` (permiso en la UI).

## Specs

**S1 — El pedido.** Del dueño (2026-11-23), verbatim:

> "cuando termines de hacer eso lo de responsive vas a hacer a configurar esa parte que hicimos anteriormente la de escanear el código de barra y lo vas a hacer que se pueda editar el ab el editar el stop de cualquiera de esos productos escaneos es decir se puede reducir tanto aumenta yo puedo escribir la cantidad o le puedo dar un botón de más y menos para sumar y restar va a tener que hacer un cambios en el backing y en el administrador de farmacias que es donde quieras a la gente que entra en el rp va a agregar un permiso hacia esa funcionalidad"

Es decir: al escanear y ver el producto, poder **sumar o restar stock** —escribiendo la cantidad o con botones − / +— y que eso esté detrás de un **permiso nuevo** que se asigna en el administrador de farmacias.

**S2 — Repos autorizados.** El dueño autorizó escribir en los tres: "Autorizo ambos repos" (backend y administrador de farmacias), además de `ERP_medizin_web`.

**S3 — Solo lectura hoy.** La pantalla `/escaner` (feature `barcode-scan-price`) **no escribe nada**: consulta precio y stock y nada más. Este pedido es la rebanada de escritura que en su momento se dejó fuera a propósito.

**S4 — Toda modificación deja rastro.** Un cambio de stock sin movimiento auditado es un descuadre que aparece días después sin saber de dónde salió. El único camino atómico del backend es `POST /admin/inventario/movimientos`, que aplica el stock y crea el `movimiento_inventario` en una sola transacción (ver Evidencia). `increase`/`decrease` escriben el stock y **spawnean el movimiento fire-and-forget con `aplicar_stock=false`**: no se usan.

**S5 — El stock nunca queda negativo.** `POST /admin/MedicationsAgent/increase` acepta `stock: -1` (hay un test que lo fija: `validate_stock_negative_accepted`). La pantalla nueva no manda deltas a ciegas: valida contra el stock leído y el backend tiene que rechazar negativos.

**S6 — El permiso se llama y se aplica en un solo lugar.** Hoy `agents.permits` es `Vec<String>` libre: **ningún endpoint lee permisos para autorizar** — los guards son solo por rol. Un permiso que sólo filtra un botón en el frontend es cosmético: cualquiera con la sesión abierta puede llamar el endpoint. La decisión de alcance está en T0.

**S7 — Desktop no se toca.** La pantalla de ajuste vive en `/escaner`, que ya es exclusiva de mobile (`S8` de `barcode-scan-price`). Ninguna otra pantalla cambia.

## Evidencia del reconocimiento (2026-11-23)

**Backend (`Backend-administrativo`):**
- `POST /admin/inventario/movimientos` — **único camino atómico**: un `BEGIN…COMMIT` que aplica stock por lote FIFO (`math::max([0, stock - desc])`) y crea el `movimiento_inventario` (`src/features/inventory_movements/src/infrastructure/repositories.rs:552,650-690`). `tipo ∈ EntradaExtra|Perdida|Danio|Vencimiento|Ajuste|Venta|Devolucion` (`src/shape/src/models/model_movimiento_inventario.rs:51-58`). **No tiene doc en `docs/api/`.**
- `POST /admin/MedicationsAgent/increase` — stock aditivo y además precio, IVA, mínimo y lote en un solo UPDATE; el movimiento se lanza aparte con `aplicar_stock=false` (`controllers/increase_inventory.rs:182-232`). Valida poco: sólo farmacia y código no vacíos.
- `POST /admin/MedicationsAgent/decrease` — asignador FIFO con CAS (`WHERE stock >= $q RETURN BEFORE`) y compensación; si falta stock responde **500**, no 409 (`decrease_inventory.rs:104-112`).
- `pharmacy_inventory` es *schemaless* y **no tiene columna de versión**: no hay locking optimista (`src/infra/src/clientsurrealdb.rs:263-277`).
- Permisos: `agents.permits: Vec<String>` (`src/shape/src/models/model_agent.rs:61`), escritos por `PUT /admin/Agent/permits`. Los grupos usan un enum cerrado distinto (`model_pharmacygroup.rs:53`). **Ningún guard lee permisos**: `RequestContext` lleva roles, no permisos (`src/shape/src/helper/request_context.rs:17-45`), y el JWT tampoco los lleva (`src/http/src/jsonwebtoken/jsonwebtoken.rs:18-33`).

**Administrador de farmacias (`pharmacy-administrator-medizin`):**
- La lista de permisos de agente es un array de strings hardcodeado: `features/general/agentes/types/agentes.constans.tsx:25-38`, con `"Productos en stock"` en `:32`. Los dos modales (ver y crear agente) lo recorren, así que **agregar un literal alcanza** para que se pueda asignar.
- Transporte: `PUT /admin/Agent/permits` con `{ id, permits }` (`VerAgenteModal.tsx:185-188`); se leen de vuelta en el login (`lib/auth.ts:89,126`) y llegan a `profile.permits`.
- No comparte código con `ERP_medizin_web`: la lista está duplicada por literal en los dos repos.

## Tasks

| ID | Tarea | Specs |
| --- | --- | --- |
| T0 | **Decisión de alcance de la autorización**: permiso aplicado sólo en la UI, o permiso aplicado también en el backend (JWT + guard). Bloquea T2. | S6 |
| T1 | Permiso nuevo en el administrador: literal en `AGENT_PERMISSIONS` | S1 |
| T2 | Backend: endpoint de ajuste con delta, validación de no-negativo, movimiento auditado en la misma transacción, y (según T0) chequeo de permiso | S4, S5, S6 |
| T3 | ERP: en `/escaner`, control de cantidad con − / + y campo editable, tope contra el stock leído, confirmación explícita antes de escribir | S1, S5 |
| T4 | ERP: gate por permiso — sin el permiso, `/escaner` sigue leyendo pero no muestra el ajuste | S1, S6 |
| T5 | Verificación: tests del cálculo del delta y del tope; prueba real con un producto de la farmacia | S4, S5 |

Non-goals: editar precio desde el escáner, ajuste masivo, edición de lotes/vencimiento, cambiar la pantalla de productos.

## Log

**L1** (pedido original, verbatim): el texto de S1.

**L2** (autorización): "Autorizo ambos repos" — backend y administrador de farmacias incluidos.

**L3** (estado previo, 2026-11-23): el responsive mobile quedó mergeado y desplegado en `master 8bc11c7`; `/escaner` está en producción con el fix de decodificación (`5c51529`), que acepta solo simbologías con dígito verificador y exige dos lecturas iguales seguidas.

**L4** (implementado, 2026-11-23): las tres rebanadas quedaron en ramas `feat/scanner-stock-adjust` de los tres repos.

- Backend `b631371d`: `POST /admin/inventory/adjust`, delta con compare-and-set por lote, movimiento `EntradaExtra`/`Ajuste` en la misma transacción, rechazo de stock negativo con 422 (nunca 500), y permiso leído de `agents.permits` por el agente del token. La identidad **sí** viene en el token (`claims.user_id` → `RequestContext.user_id`). Los roles de gestión conservan el bypass que ya tenían sobre los otros escritores de inventario. 53 tests en el crate. Se agregó además el brazo `"inventory"` a `role_guard`, que faltaba y fallaba abierto.
- Administrador `fc412a9`: el literal `Ajustar stock desde escáner` en `AGENT_PERMISSIONS`, que es lo único necesario para poder asignarlo (los dos modales recorren ese array).
- ERP `4311047`: campo numérico + botones − / + de 44px, tope contra el stock conocido y confirmación explícita; el control no se monta sin el permiso y no se hace ninguna llamada de escritura. 20 tests nuevos (44 en `test:scanner`).

**L5** (corte de rebanada): el commit del backend son ~890 líneas propias en un solo commit, por encima del objetivo de ~400. La unidad es coherente (dominio + caso de uso + repositorio + controller + DI + montaje + tests + doc) y separarla dejaría commits que no compilan por sí solos, así que se entrega como un commit por repo y se revisa repo por repo.

**L6** (desvío confirmado): el backend **no tiene** helper de normalización de ceros para búsqueda (solo la migración de datos `normalize_barcode_leading_zeros`). El endpoint compara `bar_code` exacto y el teléfono manda el `barCode` guardado del producto ya resuelto, así que la escalera de intentos sigue viviendo solo en el front. Si más adelante hace falta del lado servidor, hay que decidir dónde vive ese helper canónico.
