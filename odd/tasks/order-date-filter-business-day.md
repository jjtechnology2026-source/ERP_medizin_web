# Filtro de fecha por día comercial Caracas — reconciliación con el Z

Feature: `order-date-filter-business-day`
Owner: parent session (el Gentleman)
Repos: `ERP_medizin_web` (core), `pharmacy-administrator-medizin` (admin)

## Problema (evidencia, 2026-10-07)

El dueño de `DETODOFARMACY C.A` reporta que **las ventas no cuadran con el Z** y
muestra la pantalla `registro-ordenes`:

- Filtro puesto: **06/10/2026 → 07/10/2026**.
- Tarjeta **Ventas Netas · Todo el Filtro: Bs 169.535,44** (Bruto 169.535,44 ·
  Devuelto 0,00), 28 órdenes cargadas / 28 completadas.
- **La lista muestra filas con FECHA 5/10/2026** (jirkin palacios, jemail…).

Audio del dueño: *"puse del día 6 y el día 7 y tengo órdenes del día 5… le resté
todas las órdenes del día 5 y me dio similar al [número del] Z, con una diferencia
como de 600 bolos."*

`169.535,44 Bs ÷ 873,87 (tasa de la pantalla) = 194,006 USD`, el mismo `$194.006 USD`
de la pantalla *Estadísticas y Ventas* (28 órdenes): las dos superficies muestran el
**mismo conjunto mal filtrado**.

### Causa raíz

`modules/orders/hooks/useOrders.ts` arma el filtro con `new Date(filters.date_start).toISOString()`.
Un `<input type="date">` entrega `"2026-10-06"`, y `new Date("2026-10-06")` se parsea
como **medianoche UTC**. El backend filtra `date >= $start AND date < $end`.

Con "del 6 al 7" el rango real es `[05/10 20:00 → 06/10 20:00]` hora Caracas:

1. **Entran** las órdenes de la noche del 5/10 (se ven como `5/10/2026`).
2. **Quedan fuera** las del 6/10 de 20:00 a 24:00 **y todo el 7/10** — de ahí los
   "~600 bolos" que faltan tras restar el día 5.

Dos defectos en el mismo armado: **desfase UTC−4** y **`end` exclusivo** (el día
final elegido nunca entra).

### Contexto

La clase de bug ya estaba documentada y resuelta para los Z el 06/10
(`odd/tasks/z-report-business-day-range.md`, `fiscal_calendar::business_day_bounds`
UTC−4 fijo). `modules/core/utils/date.ts` **avisa exactamente de esto** para filtros,
pero los filtros de listado nunca se migraron. Los worktrees `erp-stats-neto` y
`fix/product-returns-net` no lo tocan (`useOrders.ts` idéntico).

## Decisiones

- **D1** — El día comercial es el día calendario de Caracas, offset **fijo UTC−4**
  (Venezuela sin DST desde 2016), expresado una sola vez, igual que el backend.
- **D2** — `date.start` = 00:00 Caracas del día elegido = `T04:00:00.000Z`.
- **D3** — `date.end` = **último milisegundo** del día elegido = `T03:59:59.999Z`
  del día siguiente. Sirve tanto para backends `date < $end` (órdenes) como
  `date <= $end` (reportes/auditoría).
- **D4** — El offset es fijo, no el de la máquina del operador: un cliente fuera de
  Caracas debe mandar el mismo rango que uno en Caracas.

## Requerimientos

- REQ-1 Un helper puro construye los límites del día comercial desde `YYYY-MM-DD`.
- REQ-2 `businessDayStartIso("2026-10-06")` = `2026-10-06T04:00:00.000Z`.
- REQ-3 `businessDayEndIso("2026-10-06")` = `2026-10-07T03:59:59.999Z`.
- REQ-4 Un `YYYY-MM-DD` inválido lanza (falla fuerte, no filtra en silencio).
- REQ-5 Todos los filtros `date.start`/`date.end` del ERP usan los helpers.
- REQ-6 El admin (`ventasTotales` y `dateFilters.ts`) usa los mismos límites.
- REQ-7 El resultado es determinista sin importar el `TZ` del proceso.

## Tareas

### T-01 — helper de día comercial (REQ-1, REQ-2, REQ-3, REQ-4, REQ-7)
`modules/core/utils/date.ts`: `businessDayStartIso` / `businessDayEndIso` +
`test/date-utils.test.mjs`. Correr con `TZ=America/Caracas` y también con `TZ=UTC`
para probar REQ-7.

### T-02 — call sites del ERP (REQ-5)
`modules/orders/hooks/useOrders.ts`, `modules/marketplace/hooks/useMarketplace.ts`,
`modules/statistics/index.tsx`, `modules/audit/services/audit.ts`.

### T-03 — admin (REQ-6)
`features/general/reportes/utils/dateFilters.ts` (`buildUtcBoundary`) y
`app/(secciones)/(general)/ventasTotales/page.tsx`.

## Non-goals

- No cambia el contrato del backend ni la base de datos.
- No toca la fecha fiscal del Z (ya resuelta).
- No se toca el display de fechas más allá del filtro.

## Verificación

- `npm run test:date-utils` (ERP) en `TZ=America/Caracas` y `TZ=UTC`.
- `npx tsc --noEmit` (admin).

## Outcome

### Estado

| Work unit | Estado |
| --- | --- |
| T-01 helper día comercial (ERP) | done |
| T-02 call sites ERP (orders, marketplace, statistics, audit) | done |
| T-03 admin (`dateFilters.ts`, `ventasTotales`) | done |

### Commits

| Repo | Rama | Commit |
| --- | --- | --- |
| `ERP_medizin_web` | `fix/orders-business-day-filter` (desde `origin/master` `fa81f40`) | `038dfc6` |
| `pharmacy-administrator-medizin` | `fix/orders-business-day-filter` (desde `origin/main` `3ec31be`) | `04478ec` |

### Evidencia

- `npm run test:date-utils` (ERP, `TZ=America/Caracas`): **13 passed, 0 failed**.
- Los 5 tests nuevos (`businessDay*`) pasan también con **`TZ=UTC`**: son
  deterministas, no dependen del reloj del proceso (REQ-7). Los 3 rojos con
  `TZ=UTC` son los tests viejos de `localDateStr`/`daysAgoStr`, TZ-dependientes
  por diseño.
- `npx --no-install tsc --noEmit`: **exit 0** en ERP y en admin.
- Salida del helper (ERP), verificada a mano:
  `businessDayStartIso("2026-10-06") = 2026-10-06T04:00:00.000Z`,
  `businessDayEndIso("2026-10-06") = 2026-10-07T03:59:59.999Z`.

### Pendiente

1. **Push / deploy.** Los commits están locales en worktrees; no se
   pushearon. ERP deploya desde `master` y admin desde `main`.
2. **Smoke en vivo.** Repetir el filtro 06/10→07/10 en `registro-ordenes` y
   confirmar que ya no aparecen las órdenes con FECHA 5/10, y que
   *Ventas Netas* cierra con el libro de ventas.
3. Otros campos de fecha que se muestran (columna FECHA) se dejan como están:
   con el filtro correcto, una orden del 5/10 local ya no entra en el rango del 6.
