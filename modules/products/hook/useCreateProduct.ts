import { useState, useCallback } from "react";

export interface MedicationData {
  brand: string;
  activeIngredient: string;
  dosage: string;
  barCode: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  stock: number;
  description: string;
  controlled: boolean;
  vat: number;
  antibiotic: boolean;
  minimum: number;
}

export const useCreateMedication = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMedication = useCallback(async (baseData: any, imagesList: { name: string; data: number[] }[] = []) => {
    setIsLoading(true);
    setError(null);

    try {
      // Concatenamos la dosis con su unidad
      const dosage = `${baseData.doseValue || ""}${baseData.doseUnit || ""}`;

      const payloadData: MedicationData = {
        brand: baseData.brand,
        activeIngredient: baseData.activeIngredient,
        dosage,
        barCode: baseData.barCode,
        name: baseData.name,
        category: baseData.category,
        subcategory: baseData.subcategory,
        price: 0.0,
        stock: 0,
        description: baseData.description || "",
        controlled: baseData.controlled || false,
        vat: baseData.vat,
        antibiotic: baseData.antibiotic || false,
        minimum: baseData.minimum,
      };

      // 1. Crear el producto
      const medResponse = await fetch("/Medications/Create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadData),
      });

      if (!medResponse.ok) {
        throw new Error("Error al crear el medicamento.");
      }

      const medResult = await medResponse.json();

      // 2. Subir múltiples imágenes (si existen)
      const uploadedImages = [];
      for (const imgFile of imagesList) {
        const imageResponse = await fetch("/admin/MedicationImage/Upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(imgFile),
        });

        if (!imageResponse.ok) {
          throw new Error(`Error al subir la imagen: ${imgFile.name}`);
        }

        const imageResult = await imageResponse.json();
        uploadedImages.push(imageResult);
      }

      return { success: true, medication: medResult, images: uploadedImages };
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado.");
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { createMedication, isLoading, error };
};
