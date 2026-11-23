import type { Medication } from "../types/products.types";

/**
 * Cuerpo exacto de `PUT /admin/products/update` (las 13 claves de `ProductUpdateDto`).
 *
 * El backend mapea ese DTO con `unwrap_or_default()`
 * (`Backend-administrativo/src/features/products/src/adapters/mappers.rs`), así que
 * una clave que **no** viaja en el cuerpo borra la columna guardada. Este constructor
 * las enumera siempre, sin importar qué campos editó el operador.
 */
export interface ProductUpdatePayload {
  activeIngredient: string;
  antibiotic: boolean;
  barCode: string;
  brand: string;
  category: string;
  controlled: boolean;
  description: string;
  dosage: string;
  image: string;
  name: string;
  subcategory: string;
  tablets: string;
  vat: number;
}

/** Normaliza un producto a un cuerpo de actualización completo. */
export function buildProductUpdatePayload(medication: Medication): ProductUpdatePayload {
  return {
    activeIngredient: medication.activeIngredient ?? "",
    antibiotic: Boolean(medication.antibiotic),
    barCode: medication.barCode,
    brand: medication.brand ?? "",
    category: medication.category ?? "",
    controlled: Boolean(medication.controlled),
    description: medication.description ?? "",
    dosage: medication.dosage ?? "",
    image: medication.image && typeof medication.image === "string" ? medication.image : "",
    name: medication.name ?? "",
    subcategory: medication.subcategory ?? "",
    tablets: medication.tablets ?? "",
    vat: Number(medication.vat) || 0,
  };
}
