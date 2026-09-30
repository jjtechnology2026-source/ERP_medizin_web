import { test } from "node:test";
import assert from "node:assert/strict";

import { localDateStr, daysAgoStr } from "../modules/core/utils/date.ts";

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
