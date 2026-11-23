import test from "node:test";
import assert from "node:assert/strict";
import { lookupScannedCode } from "./barcode-lookup.ts";

const product = (barCode, name) => ({ barCode, name, price: 10, stock: 3, minimum: 1 });

test("codigo exacto: devuelve ese producto y consulta una sola vez", async () => {
  const rows = [product("7590000000001", "OTRO"), product("7591234567890", "CORRECTO")];
  const queries = [];
  const result = await lookupScannedCode({
    code: "7591234567890",
    pharmacyId: "ph-1",
    queryInventory: async (query) => {
      queries.push(query);
      return rows;
    },
  });

  assert.deepEqual(result, { status: "found", product: rows[1] });
  assert.deepEqual(queries, ["7591234567890"]);
});

test("sin coincidencia: no devuelve el vecino difuso, muestra el codigo escaneado", async () => {
  const rows = [product("7590000000001", "OTRO"), product("7590000000002", "OTRO MAS")];
  const result = await lookupScannedCode({
    code: "7599999999999",
    pharmacyId: "ph-1",
    queryInventory: async () => rows,
  });

  assert.deepEqual(result, { status: "not-found", code: "7599999999999" });
});

test("escaneado con cero a la izquierda: reintenta sin el cero hasta matchear", async () => {
  const queries = [];
  const result = await lookupScannedCode({
    code: "0123456789012",
    pharmacyId: "ph-1",
    queryInventory: async (query) => {
      queries.push(query);
      return query === "123456789012" ? [product("123456789012", "UPC-A")] : [];
    },
  });

  assert.equal(result.status, "found");
  assert.equal(result.product.name, "UPC-A");
  assert.deepEqual(queries, ["0123456789012", "123456789012"]);
});

test("escaneado de 12 digitos: reintenta rellenado a 13 y matchea el guardado", async () => {
  const queries = [];
  const result = await lookupScannedCode({
    code: "123456789012",
    pharmacyId: "ph-1",
    queryInventory: async (query) => {
      queries.push(query);
      return query === "0123456789012" ? [product("0123456789012", "EAN-13")] : [];
    },
  });

  assert.equal(result.status, "found");
  assert.equal(result.product.name, "EAN-13");
  assert.deepEqual(queries, ["123456789012", "0123456789012"]);
});

test("sin farmacia asignada: mensaje explicito y ninguna consulta al backend", async () => {
  const queries = [];
  const result = await lookupScannedCode({
    code: "7591234567890",
    pharmacyId: "",
    queryInventory: async (query) => {
      queries.push(query);
      return [];
    },
  });

  assert.deepEqual(result, { status: "no-pharmacy" });
  assert.deepEqual(queries, []);
});

test("codigo vacio: no consulta y no inventa un producto", async () => {
  const queries = [];
  const result = await lookupScannedCode({
    code: "   ",
    pharmacyId: "ph-1",
    queryInventory: async (query) => {
      queries.push(query);
      return [product("7590000000001", "OTRO")];
    },
  });

  assert.deepEqual(result, { status: "not-found", code: "" });
  assert.deepEqual(queries, []);
});

test("falla de red: estado de error con el mensaje de la excepcion", async () => {
  const result = await lookupScannedCode({
    code: "7591234567890",
    pharmacyId: "ph-1",
    queryInventory: async () => {
      throw new Error("Network Error");
    },
  });

  assert.deepEqual(result, { status: "error", message: "Network Error" });
});
