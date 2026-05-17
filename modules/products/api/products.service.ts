import api from "@/modules/core/api/client";
import { Medication, BulkProductRow } from "@/modules/products/types/products.types";

const cleanImg = (item: any) => ({
  ...item,
  image: item.image && typeof item.image === "string" && (item.image.startsWith("http") || item.image.startsWith("data:")) ? item.image : "",
  stock: item.stock !== undefined ? Number(item.stock) : (item.quantity !== undefined ? Number(item.quantity) : 0),
  quantity: item.quantity !== undefined ? Number(item.quantity) : (item.stock !== undefined ? Number(item.stock) : 0),
  price: Number(item.price) || 0,
});

export const productsService = {
  async getInventory(): Promise<Medication[]> {
    const { data } = await api.get("/admin/Inventory/Stock");
    const rawItems = Array.isArray(data) ? data : data?.result ?? data?.data ?? data?.medications ?? [];
    return rawItems.map(cleanImg);
  },

  async getCatalog(): Promise<Medication[]> {
    try {
      const { data } = await api.post("/Medications/list", "null", {
        headers: { "Content-Type": "application/json" },
      });
      const rawItems = Array.isArray(data)
        ? data
        : data?.medications ?? data?.result ?? data?.data ?? [];
      return rawItems.map(cleanImg);
    } catch (e) {
      console.error("Error al obtener catálogo real de medicamentos:", e);
      return [];
    }
  },

  async createProduct(medication: Partial<Medication>): Promise<Medication> {
    const { data } = await api.post("/admin/Medications/create", medication);
    return data;
  },

  async upsertProducts(medications: Partial<Medication>[]): Promise<void> {
    await api.post("/admin/Medications/upsert", { medications });
  },

  async uploadImage(image: { name: string; data: number[] }): Promise<unknown> {
    const { data } = await api.post("/admin/image/save", image);
    return data;
  },

  async uploadMedicationImages(
    imagesList: { name: string; data: number[] }[]
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const img of imagesList) {
      const result = await this.uploadImage(img);
      results.push(result);
    }
    return results;
  },

  async bulkImportWithProgress(
    products: BulkProductRow[],
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;
    const total = products.length;
    for (let i = 0; i < total; i++) {
      const product = products[i];
      onProgress?.(i + 1, total, product.name);
      try {
        await this.createProduct({
          brand: product.brand,
          activeIngredient: product.activeIngredient,
          dosage: product.dosage,
          tablets: product.tablets,
          barCode: product.barCode,
          name: product.name,
          category: product.category,
          subcategory: product.subcategory,
          description: product.description,
          controlled: product.controlled,
          antibiotic: product.antibiotic,
          price: 0,
          stock: 0,
          vat: 16,
          minimum: 0,
        });
        success++;
      } catch {
        errors.push(`Error al crear "${product.name}" (código: ${product.barCode})`);
      }
    }
    return { success, errors };
  },

  async bulkImport(products: BulkProductRow[]): Promise<{ success: number; errors: string[] }> {
    return this.bulkImportWithProgress(products);
  },
};
