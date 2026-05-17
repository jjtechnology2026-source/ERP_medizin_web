export interface Medication {
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
  vat: number;
  antibiotic: boolean;
  minimum: number;
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
}

export interface BulkProductParseResult {
  products: BulkProductRow[];
  errors: string[];
}
