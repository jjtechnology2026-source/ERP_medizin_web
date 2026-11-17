import test from "node:test";
import assert from "node:assert/strict";
import { saveErrorMessage } from "../modules/products/lib/save-error.ts";

// The backend rejects a write with a plain-text body, e.g.
// `profit_percentage must be between 0 and 100 with at most 2 decimals`.
const backendText =
  "profit_percentage must be between 0 and 100 with at most 2 decimals (20 == 20%)";

const axiosLike = (data, message = "Request failed with status code 400") => {
  const error = new Error(message);
  error.response = { status: 400, data };
  return error;
};

test("usa el texto del body del backend cuando es texto plano", () => {
  assert.equal(saveErrorMessage(axiosLike(backendText)), backendText);
});

test("usa body.message cuando el body es un objeto con mensaje", () => {
  assert.equal(saveErrorMessage(axiosLike({ message: backendText })), backendText);
});

test("usa body.error como segundo alias del backend", () => {
  assert.equal(saveErrorMessage(axiosLike({ error: backendText })), backendText);
});

test("prefiere el texto del backend sobre el mensaje de axios", () => {
  assert.equal(saveErrorMessage(axiosLike(backendText)), backendText);
});

test("cae al mensaje del Error cuando el body no trae texto usable", () => {
  assert.equal(
    saveErrorMessage(axiosLike({ unexpected: true })),
    "Request failed with status code 400"
  );
  assert.equal(saveErrorMessage(axiosLike(null)), "Request failed with status code 400");
});

test("ignora bodies vacíos o en blanco", () => {
  assert.equal(saveErrorMessage(axiosLike("   ")), "Request failed with status code 400");
  assert.equal(saveErrorMessage(axiosLike({ message: "  " })), "Request failed with status code 400");
});

test("nunca imprime [object Object] ni textos vacíos", () => {
  assert.equal(saveErrorMessage({}), "Error al guardar el producto");
  assert.equal(saveErrorMessage(null), "Error al guardar el producto");
  assert.equal(saveErrorMessage(undefined), "Error al guardar el producto");
});

test("acepta un string lanzado directamente", () => {
  assert.equal(saveErrorMessage(backendText), backendText);
});

test("respeta el fallback pedido por el llamador", () => {
  assert.equal(saveErrorMessage({}, "No se pudo guardar"), "No se pudo guardar");
});

test("caso real del POS: profit 37.5 rechazado muestra el motivo del backend", () => {
  // Antes de la corrección: 400 con el texto del contrato y en la UI
  // "Error al guardar el producto", que ocultaba la causa.
  const error = axiosLike(backendText);
  assert.match(saveErrorMessage(error), /profit_percentage/);
  assert.notEqual(saveErrorMessage(error), "Error al guardar el producto");
});
