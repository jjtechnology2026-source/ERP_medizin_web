import api from "@/modules/core/api/client";
import { Medication, BulkProductRow } from "@/modules/products/types/products.types";

const cleanImg = (item: any) => ({
  ...item,
  image: item.image && typeof item.image === "string" && (item.image.startsWith("http") || item.image.startsWith("data:")) ? item.image : "",
  stock: item.stock !== undefined ? Number(item.stock) : (item.quantity !== undefined ? Number(item.quantity) : 0),
  quantity: item.quantity !== undefined ? Number(item.quantity) : (item.stock !== undefined ? Number(item.stock) : 0),
  price: Number(item.price) || 0,
  vat: Math.round(Number(item.vat)) || 0,
  minimum: Math.round(Number(item.minimum)) || 0,
});

export const productsService = {
  /** Carga catálogo con cursor paginado desde SurrealDB */
  async getCatalog(cursor?: string, size = 5000): Promise<{
    medications: Medication[];
    next_cursor: string | null;
  }> {
    const payload: any = { size };
    if (cursor) payload.cursor = cursor;
    const { data } = await api.post("/Medications/list", payload, {
      headers: { "Content-Type": "application/json" },
    });
    const rawItems = Array.isArray(data?.medications)
      ? data.medications
      : Array.isArray(data) ? data : [];
    return {
      medications: rawItems.map(cleanImg),
      next_cursor: data?.next_cursor ?? data?.cursor ?? null,
    };
  },

  /** Carga inventario de una farmacia con cursor paginado */
  async getCursorInventory(pharmacyId: string, cursor?: string, limit = 200): Promise<{
    medications: Medication[];
    next_cursor: string | null;
    has_more: boolean;
    total: number;
  }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    const { data } = await api.get(
      `/admin/Pharmacy/${pharmacyId}/medications/cursor?${params}`
    );
    return {
      medications: (data.medications ?? []).map(cleanImg),
      next_cursor: data.next_cursor ?? null,
      has_more: data.has_more ?? false,
      total: data.total ?? 0,
    };
  },

  async createProduct(medication: Partial<Medication>): Promise<Medication> {
    const payload = [{
      brand: medication.brand || "",
      activeIngredient: medication.activeIngredient || "",
      dosage: medication.dosage || "",
      tablets: medication.tablets || "",
      barCode: medication.barCode || "",
      name: medication.name || "",
      image: medication.image && typeof medication.image === "string" ? medication.image : "",
      category: medication.category || "",
      subcategory: medication.subcategory || "",
      price: Number(medication.price) || 0,
      quantity: medication.stock !== undefined ? Number(medication.stock) : (Number(medication.quantity) || 0),
      stock: medication.stock !== undefined ? Number(medication.stock) : (Number(medication.quantity) || 0),
      description: medication.description || "",
      controlled: Boolean(medication.controlled),
      vat: Math.round(Number(medication.vat)) || 0,
      antibiotic: Boolean(medication.antibiotic),
      minimum: Math.round(Number(medication.minimum)) || 0,
      detalle: (medication as any).detalle || "",
    }];

    await api.post("/Medications/Create", payload);
    return cleanImg(medication);
  },

  async upsertProducts(medications: Partial<Medication>[]): Promise<void> {
    const payload = medications.map((medication) => ({
      brand: medication.brand || "",
      activeIngredient: medication.activeIngredient || "",
      dosage: medication.dosage || "",
      tablets: medication.tablets || "",
      barCode: medication.barCode || "",
      name: medication.name || "",
      image: medication.image && typeof medication.image === "string" ? medication.image : "",
      category: medication.category || "",
      subcategory: medication.subcategory || "",
      price: Number(medication.price) || 0,
      quantity: medication.stock !== undefined ? Number(medication.stock) : (Number(medication.quantity) || 0),
      stock: medication.stock !== undefined ? Number(medication.stock) : (Number(medication.quantity) || 0),
      description: medication.description || "",
      controlled: Boolean(medication.controlled),
      vat: Math.round(Number(medication.vat)) || 0,
      antibiotic: Boolean(medication.antibiotic),
      minimum: Math.round(Number(medication.minimum)) || 0,
      detalle: (medication as any).detalle || "",
    }));

    await api.post("/admin/Medications/upsert", payload);
  },

  async uploadImage(image: { name: string; data: number[] }): Promise<unknown> {
    const { data } = await api.post("/admin/MedicationImage/Upload", image);
    return data;
  },

  async uploadMedicationImages(
    imagesList: { name: string; data: number[] }[]
  ): Promise<unknown[]> {
    return Promise.all(imagesList.map((img) => this.uploadImage(img)));
  },

  async bulkImportWithProgress(
    products: BulkProductRow[],
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<{ success: number; errors: string[]; created: Medication[] }> {
    const errors: string[] = [];
    const created: Medication[] = [];
    const total = products.length;
    for (let i = 0; i < total; i++) {
      const product = products[i];
      onProgress?.(i + 1, total, product.name);
      try {
        const medication = await this.createProduct({
          brand: product.brand,
          activeIngredient: product.activeIngredient,
          dosage: product.dosage,
          tablets: product.tablets,
          barCode: product.barCode,
          name: product.name,
          category: product.category || "General",
          subcategory: product.subcategory || "Varios",
          description: product.description,
          controlled: product.controlled,
          antibiotic: product.antibiotic,
          price: product.price ?? 0,
          stock: product.stock ?? 0,
          vat: product.vat ?? 16,
          minimum: product.minimum ?? 0,
        });
        created.push(medication);
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || "Error desconocido";
        errors.push(`Error al crear "${product.name}" (código: ${product.barCode}): ${msg}`);
      }
    }
    return { success: created.length, errors, created };
  },

  async deleteProduct(barCode: string): Promise<void> {
    await api.delete("/Medications/Delete", { data: { bar_code: barCode } });
  },

  /** Aumenta inventario vía HTTP (reemplaza MQTT) */
  async increaseInventory(pharmacyId: string, medications: { bar_code: string; stock: number; price: number; minimum: number }[]): Promise<void> {
    await api.post("/admin/MedicationsAgent/increase", {
      pharmacy_id: pharmacyId,
      medications,
    });
  },

  async bulkImport(products: BulkProductRow[]): Promise<{ success: number; errors: string[]; created: Medication[] }> {
    return this.bulkImportWithProgress(products);
  },
};
