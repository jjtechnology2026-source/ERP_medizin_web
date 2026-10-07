import { test } from "node:test";
import assert from "node:assert/strict";

import { localDateStr, daysAgoStr, businessDayStartIso, businessDayEndIso } from "../modules/core/utils/date.ts";

// El script corre con TZ=America/Caracas (UTC-4) para que los casos de borde de
// zona horaria sean deterministas. Venezuela es el caso real de la farmacia.

test("localDateStr usa la fecha local, no la UTC (el bug que ocultaba las facturas del dia)", () => {
  // 2026-10-01T01:00Z en Caracas todavia es el 30/09 a las 21:00.
  // toISOString() devolveria "2026-10-01" y un filtro con esa fecha escondia
  // los documentos recien emitidos.
  assert.equal(localDateStr(new Date("2026-10-01T01:00:00Z")), "2026-09-30");
});

test("localDateStr con un instante de la madrugada UTC devuelve el dia local anterior", () => {
  assert.equal(localDateStr(new Date("2026-09-30T02:00:00Z")), "2026-09-29");
});

test("localDateStr con el mediodia local coincide con la fecha esperada", () => {
  assert.equal(localDateStr(new Date(2026, 8, 30, 12, 0, 0)), "2026-09-30");
});

test("localDateStr rellena mes y dia con cero", () => {
  assert.equal(localDateStr(new Date(2026, 0, 5, 12, 0, 0)), "2026-01-05");
});

test("daysAgoStr(0) es hoy", () => {
  const now = new Date(2026, 8, 30, 12, 0, 0);
  assert.equal(daysAgoStr(0, now), localDateStr(now));
});

test("daysAgoStr(30) desde el 30/09 cae en el 31/08", () => {
  assert.equal(daysAgoStr(30, new Date(2026, 8, 30, 12, 0, 0)), "2026-08-31");
});

test("daysAgoStr cruza el cambio de anio", () => {
  assert.equal(daysAgoStr(1, new Date(2026, 0, 1, 12, 0, 0)), "2025-12-31");
});

test("daysAgoStr tambien es local: a las 21:00 del 01/10 en Caracas sigue siendo el 30/09", () => {
  const now = new Date("2026-10-01T01:00:00Z");
  assert.equal(daysAgoStr(0, now), "2026-09-30");
  assert.equal(daysAgoStr(1, now), "2026-09-29");
});

// --- Día comercial Caracas (UTC-4) para filtros date.start/date.end -----------
// El offset es FIJO: estos valores no dependen del TZ del proceso, así que el
// script se corre igual con TZ=America/Caracas y con TZ=UTC (ver package.json).

test("businessDayStartIso abre el día a las 00:00 Caracas (04:00Z)", () => {
  assert.equal(businessDayStartIso("2026-10-06"), "2026-10-06T04:00:00.000Z");
});

test("businessDayEndIso cierra en el último ms del día Caracas", () => {
  assert.equal(businessDayEndIso("2026-10-06"), "2026-10-07T03:59:59.999Z");
});

test("businessDayEndIso cruza fin de mes y fin de año", () => {
  assert.equal(businessDayEndIso("2026-09-30"), "2026-10-01T03:59:59.999Z");
  assert.equal(businessDayEndIso("2026-12-31"), "2027-01-01T03:59:59.999Z");
});

test("el rango 06/10..07/10 contiene el día completo de cada jornada local", () => {
  // Escenario del reporte: "del 6 al 7" debe cubrir 06/10 y 07/10 completos,
  // medidos en Caracas (00:00 a 23:59:59.999 local).
  const start = Date.parse(businessDayStartIso("2026-10-06"));
  const end = Date.parse(businessDayEndIso("2026-10-07"));

  // 05/10 22:00 Caracas (= 06/10 02:00Z): NO pertenece al rango.
  assert.ok(Date.parse("2026-10-06T02:00:00Z") < start);
  // 06/10 01:00 Caracas (= 06/10 05:00Z): SÍ pertenece.
  assert.ok(Date.parse("2026-10-06T05:00:00Z") >= start);
  // 07/10 23:30 Caracas (= 08/10 03:30Z): SÍ pertenece (antes era excluido).
  assert.ok(Date.parse("2026-10-08T03:30:00Z") <= end);
  // 08/10 00:30 Caracas (= 08/10 04:30Z): queda fuera.
  assert.ok(Date.parse("2026-10-08T04:30:00Z") > end);
});

test("un día inválido falla fuerte en vez de filtrar en silencio", () => {
  assert.throws(() => businessDayStartIso("2026-10-06T00:00:00Z"));
  assert.throws(() => businessDayStartIso(""));
  assert.throws(() => businessDayEndIso("6/10/2026"));
});
