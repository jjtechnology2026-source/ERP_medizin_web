import test from "node:test";
import assert from "node:assert/strict";
import {
  RETAIL_BARCODE_FORMATS,
  createStabilityGate,
  isAcceptableBarcode,
  selectBarcodeResult,
} from "./barcode-acceptance.ts";

// Caso real del video de Jir (2026-11-23 22:13, caja "7 591519 000948"):
// el producto tiene 7591519000948 y la app mostró "código no encontrado" con
// 0481718000948. La lectura mala vino de una simbología sin dígito verificador,
// que zxing marca como válida igual.
const CODIGO_REAL = "7591519000948";
const CODIGO_FALSO = "0481718000948";

test("las simbologias sin digito verificador quedan fuera de la lista", () => {
  assert.deepEqual([...RETAIL_BARCODE_FORMATS].sort(), ["Code128", "EAN13", "EAN8", "UPCA", "UPCE"]);
  for (const sinChecksum of ["Code39", "ITF", "Codabar"]) {
    assert.equal(RETAIL_BARCODE_FORMATS.includes(sinChecksum), false, sinChecksum);
  }
});

test("EAN-13 con digito verificador correcto se acepta", () => {
  assert.equal(isAcceptableBarcode({ text: CODIGO_REAL, format: "EAN13" }), true);
});

test("EAN-13 con digito verificador incorrecto se rechaza", () => {
  assert.equal(isAcceptableBarcode({ text: "7591519000949", format: "EAN13" }), false);
});

test("un codigo leido como Code39, ITF o Codabar se rechaza aunque sea plausible", () => {
  assert.equal(isAcceptableBarcode({ text: CODIGO_FALSO, format: "Code39" }), false);
  assert.equal(isAcceptableBarcode({ text: CODIGO_FALSO, format: "ITF" }), false);
  assert.equal(isAcceptableBarcode({ text: CODIGO_FALSO, format: "Codabar" }), false);
});

test("EAN-13 exige 13 digitos y nada mas", () => {
  assert.equal(isAcceptableBarcode({ text: "759151900094", format: "EAN13" }), false);
  assert.equal(isAcceptableBarcode({ text: "75915190009485", format: "EAN13" }), false);
  assert.equal(isAcceptableBarcode({ text: "75915190009AB", format: "EAN13" }), false);
  assert.equal(isAcceptableBarcode({ text: "", format: "EAN13" }), false);
});

test("UPC-A y EAN-8 validan su propio digito verificador", () => {
  assert.equal(isAcceptableBarcode({ text: "036000291452", format: "UPCA" }), true);
  assert.equal(isAcceptableBarcode({ text: "036000291453", format: "UPCA" }), false);
  assert.equal(isAcceptableBarcode({ text: "96385074", format: "EAN8" }), true);
  assert.equal(isAcceptableBarcode({ text: "96385075", format: "EAN8" }), false);
});

test("Code128 trae su propio control: se acepta si tiene contenido", () => {
  assert.equal(isAcceptableBarcode({ text: "ABC-123", format: "Code128" }), true);
  assert.equal(isAcceptableBarcode({ text: "   ", format: "Code128" }), false);
});

test("selectBarcodeResult prefiere un EAN-13 valido sobre una lectura sucia previa", () => {
  const sucia = { text: CODIGO_FALSO, format: "Code39" };
  const buena = { text: CODIGO_REAL, format: "EAN13" };
  assert.equal(selectBarcodeResult([sucia, buena])?.text, CODIGO_REAL);
});

test("selectBarcodeResult devuelve null si nada es aceptable", () => {
  assert.equal(selectBarcodeResult([{ text: CODIGO_FALSO, format: "ITF" }]), null);
  assert.equal(selectBarcodeResult([]), null);
});

test("los espacios alrededor del codigo no lo invalidan", () => {
  assert.equal(isAcceptableBarcode({ text: `  ${CODIGO_REAL}  `, format: "EAN13" }), true);
});

test("la puerta de estabilidad exige dos lecturas iguales seguidas", () => {
  const gate = createStabilityGate(2);
  assert.equal(gate.accept(CODIGO_REAL), null, "la primera lectura no alcanza");
  assert.equal(gate.accept(CODIGO_REAL), CODIGO_REAL, "la segunda confirma");
});

test("una lectura distinta reinicia el contador: el ruido nunca se confirma", () => {
  const gate = createStabilityGate(2);
  assert.equal(gate.accept(CODIGO_FALSO), null);
  assert.equal(gate.accept(CODIGO_REAL), null);
  assert.equal(gate.accept(CODIGO_FALSO), null);
  assert.equal(gate.accept(CODIGO_REAL), null);
});

test("reset limpia el estado y vuelve a pedir dos lecturas", () => {
  const gate = createStabilityGate(2);
  gate.accept(CODIGO_REAL);
  gate.reset();
  assert.equal(gate.accept(CODIGO_REAL), null);
});
