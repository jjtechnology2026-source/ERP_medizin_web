import test from "node:test";
import assert from "node:assert/strict";
import { toIsoDate } from "../modules/products/lib/date.ts";

test("toIsoDate normaliza ISO, Date y serial de Excel", () => {
  assert.equal(toIsoDate("2026-09-16"), "2026-09-16");
  assert.equal(toIsoDate(new Date("2026-09-16T00:00:00Z")), "2026-09-16");
  // serial de Excel: 2026-09-16
  assert.equal(toIsoDate(46281), "2026-09-16");
});

test("toIsoDate acepta DD/MM/YYYY y DD-MM-YYYY", () => {
  assert.equal(toIsoDate("16/09/2026"), "2026-09-16");
  assert.equal(toIsoDate("1-9-2026"), "2026-09-01");
});

test("toIsoDate devuelve undefined para vacío o no parseable", () => {
  assert.equal(toIsoDate(""), undefined);
  assert.equal(toIsoDate(null), undefined);
  assert.equal(toIsoDate(undefined), undefined);
  assert.equal(toIsoDate("sin fecha"), undefined);
});
