import test from "node:test";
import assert from "node:assert/strict";

import {
  FACTURA_DATE_PRESETS,
  facturaDatePresetRange,
  isFacturaPresetApplied,
} from "./date-presets.ts";

// El script corre con TZ=America/Caracas (UTC-4), igual que `test:date-utils`:
// es la zona real de la farmacia y la que hace visible un rango armado con
// `toISOString()` en vez de fecha local.

/** Fecha local explícita: nunca depende del reloj de la máquina. */
const local = (y, m, d, hh = 15, mm = 30) => new Date(y, m - 1, d, hh, mm);

test("the sheet offers the four shortcuts in this order", () => {
  assert.deepEqual(
    FACTURA_DATE_PRESETS.map((p) => p.label),
    ["Hoy", "Ayer", "Esta semana", "Este mes"],
  );
});

test("today starts at the local day and leaves the upper bound empty", () => {
  // Sin `hasta`: un techo calculado con el reloj de la PC esconde la factura
  // recién emitida si ese reloj está atrasado (`modules/core/utils/date.ts`).
  assert.deepEqual(facturaDatePresetRange("today", local(2026, 11, 4)), {
    desde: "2026-11-04",
    hasta: "",
  });
});

test("yesterday closes both ends so today's documents stay out", () => {
  const range = facturaDatePresetRange("yesterday", local(2026, 11, 4));

  assert.deepEqual(range, { desde: "2026-11-03", hasta: "2026-11-03" });
  assert.ok(range.hasta < "2026-11-04");
});

test("yesterday crosses the month boundary as a calendar day", () => {
  assert.deepEqual(facturaDatePresetRange("yesterday", local(2026, 11, 1)), {
    desde: "2026-10-31",
    hasta: "2026-10-31",
  });
});

test("this week starts on the Monday before a midweek day", () => {
  // Miércoles 4 de noviembre de 2026 -> lunes 2.
  assert.deepEqual(facturaDatePresetRange("week", local(2026, 11, 4)), {
    desde: "2026-11-02",
    hasta: "",
  });
});

test("this week on a Monday is that same Monday", () => {
  assert.deepEqual(facturaDatePresetRange("week", local(2026, 11, 9)), {
    desde: "2026-11-09",
    hasta: "",
  });
});

test("this week on a Sunday goes back to the previous Monday", () => {
  assert.deepEqual(facturaDatePresetRange("week", local(2026, 11, 8)), {
    desde: "2026-11-02",
    hasta: "",
  });
});

test("this week can start in the previous month", () => {
  // Jueves 1 de octubre de 2026 -> lunes 28 de septiembre.
  assert.deepEqual(facturaDatePresetRange("week", local(2026, 10, 1)), {
    desde: "2026-09-28",
    hasta: "",
  });
});

test("this month starts on the first local day of the month", () => {
  assert.deepEqual(facturaDatePresetRange("month", local(2026, 11, 4)), {
    desde: "2026-11-01",
    hasta: "",
  });
});

test("late at night the day is still the local one, never the UTC one", () => {
  // 23:30 en Caracas ya es el día siguiente en UTC: un rango armado con
  // `toISOString()` devolvería 2026-11-05 y escondería el día en curso.
  assert.deepEqual(facturaDatePresetRange("today", local(2026, 11, 4, 23, 30)), {
    desde: "2026-11-04",
    hasta: "",
  });
});

test("every preset yields zero-padded calendar days or an empty bound", () => {
  const shape = /^(\d{4}-\d{2}-\d{2}|)$/;

  for (const preset of FACTURA_DATE_PRESETS) {
    const range = facturaDatePresetRange(preset.id, local(2026, 3, 7));
    assert.match(range.desde, shape, `${preset.id} desde`);
    assert.match(range.hasta, shape, `${preset.id} hasta`);
  }
});

// Coverage for the helper the sheet uses to light up the active shortcut. It was
// extracted with the presets, so this is not a RED case: it pins the comparison
// both bounds have to match, not just the lower one.
test("a shortcut reads as applied only when both bounds match it", () => {
  assert.equal(isFacturaPresetApplied("week", "2026-11-02", "", local(2026, 11, 4)), true);
  assert.equal(isFacturaPresetApplied("week", "2026-11-02", "2026-11-04", local(2026, 11, 4)), false);
  assert.equal(isFacturaPresetApplied("yesterday", "2026-11-03", "2026-11-03", local(2026, 11, 4)), true);
  assert.equal(isFacturaPresetApplied("today", "2026-11-03", "", local(2026, 11, 4)), false);
});
