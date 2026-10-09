import test from "node:test";
import assert from "node:assert/strict";
import { resolveCategoryOptions, resolveSubcategoryOptions } from "../modules/products/lib/catalog.ts";

test("categorias: usa la lista de la API cuando llego (incluso vacia)", () => {
  assert.deepEqual(resolveCategoryOptions(["A", "B"], ["X"]), ["A", "B"]);
  assert.deepEqual(resolveCategoryOptions([], ["X"]), []);
});

test("categorias: cae al respaldo solo si la query no entrego datos", () => {
  assert.deepEqual(resolveCategoryOptions(undefined, ["X", "Y"]), ["X", "Y"]);
});

test("subcategorias: usa la lista de la API de la categoria elegida", () => {
  assert.deepEqual(
    resolveSubcategoryOptions({ category: "Higiene", subcategories: ["Jabones"] }, ["Fallback"]),
    ["Jabones"],
  );
});

test("subcategorias: respeta la liga vacia del backend (no rellena con el respaldo)", () => {
  assert.deepEqual(
    resolveSubcategoryOptions({ category: "Ampollas", subcategories: [] }, ["Otros"]),
    [],
  );
});

test("subcategorias: cae al respaldo mientras carga o si fallo la query", () => {
  assert.deepEqual(resolveSubcategoryOptions(undefined, ["Jabones", "Otros"]), ["Jabones", "Otros"]);
});
