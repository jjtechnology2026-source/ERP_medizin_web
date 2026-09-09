import { useState, useCallback } from "react";
import api from "@/modules/core/api/client";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { productsService } from "@/modules/products/api/products.service";

export interface MedicationData {
  brand: string;
  activeIngredient: string;
  dosage: string;
  tablets: string;
  barCode: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  stock: number;
  quantity: number;
  description: string;
  controlled: boolean;
  vat: number;
  antibiotic: boolean;
  minimum: number;
  image: string;
  detalle: string;
  discount?: number;
  basePrice?: number;
  profitPercentage?: number;
  lote?: string;
}

export const useCreateMedication = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMedication = useCallback(
    async (
      baseData: any,
      imagesList: { name: string; data: number[] }[] = []
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const dosage = `${baseData.doseValue || ""} ${baseData.doseUnit || ""}`.trim();
        const tablets = `${baseData.amount || ""} ${baseData.presentation || ""}`.trim();
        const mainImage = imagesList.length > 0 ? imagesList[0].name : "";

        const payloadData: MedicationData = {
          brand: baseData.brand || "",
          activeIngredient: baseData.activeIngredient || "",
          dosage,
          tablets,
          barCode: baseData.barCode || "",
          name: baseData.name || "",
          category: baseData.category || "",
          subcategory: baseData.subcategory || "",
          price: parseFloat(baseData.price) || 0,
          stock: parseInt(baseData.stock) || 0,
          quantity: parseInt(baseData.stock) || 0,
          description: baseData.description || "",
          controlled: baseData.controlled || false,
          vat: Math.round(parseFloat(baseData.vat)) || 0,
          antibiotic: baseData.antibiotic || false,
          minimum: parseInt(baseData.minimum) || 0,
          image: mainImage,
          detalle: "",
          discount: baseData.discount !== undefined ? parseFloat(baseData.discount) : undefined,
          basePrice: baseData.basePrice !== undefined ? parseFloat(baseData.basePrice) : undefined,
          profitPercentage: baseData.profitPercentage !== undefined ? parseFloat(baseData.profitPercentage) : undefined,
          lote: typeof baseData.lote === "string" && baseData.lote.trim() ? baseData.lote.trim() : undefined,
        };

        // El lote es por-farmacia (inventario), no del catálogo universal: se envía solo en el increase.
        const catalogPayload = { ...payloadData, lote: undefined };
        const { data: medResult } = await api.post(
          "/Medications/Create",
          [catalogPayload]
        );

        const uploadedImages = await Promise.all(
          imagesList.map((imgFile) =>
            api.post("/admin/MedicationImage/Upload", imgFile).then((res) => res.data)
          )
        );

        // Ligar inventario de la farmacia vía HTTP increase (el backend ya no suscribe insert_inventory por MQTT)
        try {
          const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
          const quantityVal = parseInt(baseData.stock) || 0;
          if (pharmacyId && quantityVal > 0) {
            await productsService.increaseInventory(pharmacyId, [
              {
                bar_code: payloadData.barCode,
                stock: quantityVal,
                price: payloadData.price,
                minimum: payloadData.minimum,
                discount: payloadData.discount !== undefined ? Number(payloadData.discount) : null,
                base_price: payloadData.basePrice !== undefined ? Number(payloadData.basePrice) : null,
                profit_percentage: payloadData.profitPercentage !== undefined ? Number(payloadData.profitPercentage) : null,
                ...(payloadData.lote ? { lote: payloadData.lote } : {}),
              },
            ]);
          }
        } catch (e) {
          // noop - ligar inventario es secundario, no debe bloquear la creación
        }

        return { success: true, medication: Array.isArray(medResult) && medResult.length > 0 ? medResult[0] : medResult, images: uploadedImages };
      } catch (err: any) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Ocurrió un error inesperado.";
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { createMedication, isLoading, error };
};

