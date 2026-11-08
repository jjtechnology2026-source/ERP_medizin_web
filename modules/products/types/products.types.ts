/**
 * Catálogo de productos: el tipo decide qué campos pide la UI.
 * Debe coincidir exactamente con las variantes del enum `ProductType` del backend
 * (`Medicamento`, `Alimento`, `Servicio`, `Otro`).
 */
export type ProductType = "Medicamento" | "Alimento" | "Servicio" | "Otro";

export interface Medication {
  /** Ausente en productos anteriores al cambio de catálogo (el backend los lee como `Otro`). */
  productType?: ProductType | null;
  brand: string;
  activeIngredient: string;
  dosage: string;
  tablets: string;
  barCode: string;
  name: string;
  image: string;
  category: string;
  subcategory: string;
  price: number;
  quantity: number;
  stock: number;
  description: string;
  controlled: boolean;
  vat?: number;
  antibiotic: boolean;
  minimum: number;
  discount?: number;
  basePrice?: number;
  profitPercentage?: number;
  lote?: string;
  fechaVencimiento?: string;
}

export type StockFilter = "GENERAL" | "LOW";

export type ViewState = "LIST" | "CREATE_MANUAL" | "SEARCH_CATALOG" | "ADD_STOCK" | "STOCK_FEATURES" | "STOCK_TAX";

export interface StockSearchResult {
  medicines: Medication[];
  hasMore: boolean;
  totalCount: number;
}

export interface BulkProductRow {
  name: string;
  brand: string;
  barCode: string;
  activeIngredient: string;
  dosage: string;
  tablets: string;
  category: string;
  subcategory: string;
  description: string;
  controlled: boolean;
  antibiotic: boolean;
  price?: number;
  stock?: number;
  minimum?: number;
  vat?: number;
  discount?: number;
  basePrice?: number;
  profitPercentage?: number;
  lote?: string;
  fechaVencimiento?: string;
}

export interface BulkProductParseResult {
  products: BulkProductRow[];
  errors: string[];
}
