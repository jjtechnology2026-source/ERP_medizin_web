import test from "node:test";
import assert from "node:assert/strict";
import { resolveExactBarcode } from "../modules/products/lib/barcode-resolve.ts";

const row = (barCode, name) => ({ barCode, name });

test("codigo exacto: devuelve ese producto", () => {
  const rows = [row("7591111111111", "A"), row("7592222222222", "B")];
  assert.equal(resolveExactBarcode(rows, "7592222222222")?.name, "B");
});

test("sin coincidencia: null, nunca el primer producto de la lista", () => {
  const rows = [row("7591111111111", "A"), row("7592222222222", "B")];
  assert.equal(resolveExactBarcode(rows, "0000000000000"), null);
});

test("escaneado con cero a la izquierda: matchea el guardado sin ceros", () => {
  const rows = [row("123456789012", "UPC-A")];
  assert.equal(resolveExactBarcode(rows, "0123456789012")?.name, "UPC-A");
});

test("escaneado de 12 digitos: matchea el guardado de 13 rellenado con cero", () => {
  const rows = [row("0123456789012", "EAN-13")];
  assert.equal(resolveExactBarcode(rows, "123456789012")?.name, "EAN-13");
});

test("el match exacto gana sobre la variante sin ceros", () => {
  const rows = [row("0123456789012", "EXACTO"), row("123456789012", "SIN CERO")];
  assert.equal(resolveExactBarcode(rows, "0123456789012")?.name, "EXACTO");
});

test("ignora filas sin barCode y rechaza codigos vacios", () => {
  const rows = [row(null, "X"), row(undefined, "Y"), row("", "Z"), row("759", "ok")];
  assert.equal(resolveExactBarcode(rows, "759")?.name, "ok");
  assert.equal(resolveExactBarcode(rows, "   "), null);
  assert.equal(resolveExactBarcode(rows, ""), null);
});

test("espacios alrededor del codigo escaneado no rompen el match", () => {
  assert.equal(resolveExactBarcode([row("759", "ok")], "  759  ")?.name, "ok");
});

test("codigo alfanumerico (Code-128): se compara tal cual, sin transformaciones", () => {
  const rows = [row("ABC-123", "cod128")];
  assert.equal(resolveExactBarcode(rows, "ABC-123")?.name, "cod128");
  assert.equal(resolveExactBarcode(rows, "abc-123"), null);
});

test("lista vacia: null", () => {
  assert.equal(resolveExactBarcode([], "759"), null);
});
