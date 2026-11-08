import type { ProductType } from "../types/products.types";

export interface SubcategoriesResponse {
  category: string;
  subcategories: string[];
}

export function resolveCategoryOptions(
  fetched: string[] | undefined,
  fallback: string[],
): string[] {
  return fetched ?? fallback;
}

export function resolveSubcategoryOptions(
  fetched: SubcategoriesResponse | undefined,
  fallback: string[],
): string[] {
  return fetched?.subcategories ?? fallback;
}

/** Una opción del selector de tipo de producto (texto pensado para personal no técnico). */
export interface ProductTypeOption {
  value: ProductType;
  label: string;
  hint: string;
}

/** Opciones del selector, en el orden en que se muestran. */
export const PRODUCT_TYPE_OPTIONS: ProductTypeOption[] = [
  { value: "Otro", label: "Otro", hint: "Cualquier otro producto" },
  { value: "Medicamento", label: "Medicamento", hint: "Pastillas, jarabes, ampollas" },
  { value: "Alimento", label: "Alimento", hint: "Comida, bebida, suplemento" },
  { value: "Servicio", label: "Servicio", hint: "Corte, entrega, consulta" },
];

/** Tipo inicial del alta: el operador elige a qué catálogo pertenece el producto. */
export const DEFAULT_PRODUCT_TYPE: ProductType = "Otro";

/** Normaliza un valor leído de la API: cualquier cosa desconocida (o ausente) es `Otro`. */
export function normalizeProductType(value: unknown): ProductType {
  const match = PRODUCT_TYPE_OPTIONS.find((option) => option.value === value);
  return match ? match.value : DEFAULT_PRODUCT_TYPE;
}

/**
 * Qué campos pide el formulario para cada tipo de producto.
 *
 * Es la matriz del contrato de la UI (T5) en un solo lugar: la usan el formulario
 * de alta, el hook que arma el payload y las tarjetas que muestran el tipo, así que
 * agregar un tipo nuevo es agregar una rama acá y su opción en
 * {@link PRODUCT_TYPE_OPTIONS}.
 *
 * Regla del contrato: los campos ocultos **no se envían** (`undefined`, nunca `""`),
 * y los valores comunes ya cargados se conservan al cambiar de tipo.
 */
export interface ProductTypeFieldRules {
  activeIngredient: { visible: boolean; required: boolean; label: string };
  tablets: { visible: boolean; label: string };
  dosage: { visible: boolean };
  controlled: { visible: boolean };
  antibiotic: { visible: boolean };
  /** Stock, stock mínimo, lote y vencimiento: no aplican a un servicio. */
  stock: { visible: boolean };
  barCode: { required: boolean };
}

const COMMON_RULES: ProductTypeFieldRules = {
  activeIngredient: { visible: false, required: false, label: "Principio activo" },
  tablets: { visible: false, label: "Presentación" },
  dosage: { visible: false },
  controlled: { visible: false },
  antibiotic: { visible: false },
  stock: { visible: true },
  barCode: { required: true },
};

export function productTypeRules(type: ProductType): ProductTypeFieldRules {
  switch (type) {
    case "Medicamento":
      return {
        ...COMMON_RULES,
        activeIngredient: { visible: true, required: true, label: "Principio activo" },
        tablets: { visible: true, label: "Presentación" },
        dosage: { visible: true },
        controlled: { visible: true },
        antibiotic: { visible: true },
      };
    case "Alimento":
      // Reutiliza los campos farmacéuticos con otra etiqueta: no hay columnas nuevas.
      return {
        ...COMMON_RULES,
        activeIngredient: { visible: true, required: false, label: "Ingredientes" },
        tablets: { visible: true, label: "Presentación" },
      };
    case "Servicio":
      // Un servicio no tiene inventario ni lote: tampoco código de barras obligatorio.
      return {
        ...COMMON_RULES,
        stock: { visible: false },
        barCode: { required: false },
      };
    case "Otro":
      return { ...COMMON_RULES };
  }
}

const PRODUCT_TYPE_CHIP_CLASS: Record<ProductType, string> = {
  Medicamento: "text-blue-600 bg-blue-50 border border-blue-100",
  Alimento: "text-emerald-600 bg-emerald-50 border border-emerald-100",
  Servicio: "text-violet-600 bg-violet-50 border border-violet-100",
  Otro: "text-slate-500 bg-slate-50 border border-slate-100",
};

/** Clases tailwind del chip que muestra el tipo de producto en listados y detalles. */
export function productTypeChipClass(type: ProductType | null | undefined): string {
  return PRODUCT_TYPE_CHIP_CLASS[normalizeProductType(type)];
}
