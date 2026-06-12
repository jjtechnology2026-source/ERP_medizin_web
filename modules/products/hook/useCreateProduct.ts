import { useState, useCallback } from "react";
import api from "@/modules/core/api/client";

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
        };

        const { data: medResult } = await api.post(
          "/Medications/Create",
          [payloadData]
        );

        const uploadedImages = await Promise.all(
          imagesList.map((imgFile) =>
            api.post("/admin/MedicationImage/Upload", imgFile).then((res) => res.data)
          )
        );

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

