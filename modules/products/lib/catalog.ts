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
