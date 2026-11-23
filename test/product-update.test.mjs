/**
 * Contrato del cuerpo de `PUT /admin/products/update`.
 *
 * El backend mapea `ProductUpdateDto` con `unwrap_or_default()`: una clave que no
 * viaja en el cuerpo borra la columna guardada. Estas pruebas fallan si alguien
 * quita o renombra una clave del constructor.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildProductUpdatePayload } from "../modules/products/lib/product-update.ts";

/** Las 13 claves de `ProductUpdateDto` (backend `products/src/adapters/dto.rs`). */
const DTO_KEYS = [
  "activeIngredient",
  "antibiotic",
  "barCode",
  "brand",
  "category",
  "controlled",
  "description",
  "dosage",
  "image",
  "name",
  "subcategory",
  "tablets",
  "vat",
];

const PRODUCT = {
  brand: "Genérico",
  activeIngredient: "Ibuprofeno",
  dosage: "400mg",
  tablets: "20",
  barCode: "B1",
  name: "Ibuprofeno 400",
  image: "",
  category: "General",
  subcategory: "Varios",
  price: 1500,
  quantity: 10,
  stock: 10,
  description: "",
  controlled: false,
  vat: 16,
  antibiotic: false,
  minimum: 2,
};

test("payload de actualización: envía las 13 claves del DTO, ni una menos", () => {
  const payload = buildProductUpdatePayload(PRODUCT);

  assert.deepEqual(Object.keys(payload).sort(), [...DTO_KEYS].sort());
});

test("payload de actualización: envía las 13 claves aunque el producto esté incompleto", () => {
  const payload = buildProductUpdatePayload({ barCode: "B1", name: "Solo nombre" });

  assert.deepEqual(
    Object.keys(payload).sort(),
    [...DTO_KEYS].sort(),
    "una clave ausente borra la columna guardada en el backend",
  );
  assert.equal(payload.brand, "");
  assert.equal(payload.antibiotic, false);
  assert.equal(payload.vat, 0);
});

test("payload de actualización: conserva los valores del producto sin reinterpretarlos", () => {
  const payload = buildProductUpdatePayload({
    ...PRODUCT,
    controlled: true,
    antibiotic: true,
    image: "https://cdn.example/x.png",
    vat: 8,
  });

  assert.equal(payload.barCode, "B1");
  assert.equal(payload.name, "Ibuprofeno 400");
  assert.equal(payload.activeIngredient, "Ibuprofeno");
  assert.equal(payload.controlled, true);
  assert.equal(payload.antibiotic, true);
  assert.equal(payload.image, "https://cdn.example/x.png");
  assert.equal(payload.vat, 8);
});
