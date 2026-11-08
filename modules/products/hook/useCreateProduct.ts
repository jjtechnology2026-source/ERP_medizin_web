import { useState, useCallback } from "react";
import api from "@/modules/core/api/client";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { productsService } from "@/modules/products/api/products.service";
import { shouldWriteInventory, buildIncreaseItem } from "@/modules/products/lib/inventory-write";
import { normalizeProductType, productTypeRules } from "@/modules/products/lib/catalog";
import type { ProductType } from "@/modules/products/types/products.types";

/**
 * Payload del alta de catálogo (`POST /admin/Medications/Create`).
 *
 * Los campos farmacéuticos son opcionales a propósito: el contrato de la UI
 * manda solo lo que el operador vio según el tipo de producto, así que un campo
 * oculto viaja como `undefined` (axios lo omite del JSON) y nunca como `""`.
 */
export interface MedicationData {
  productType: ProductType;
  brand: string;
  activeIngredient?: string;
  dosage?: string;
  tablets?: string;
  barCode: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  stock?: number;
  quantity?: number;
  description: string;
  controlled?: boolean;
  vat?: number;
  antibiotic?: boolean;
  minimum?: number;
  image: string;
  detalle: string;
  discount?: number;
  basePrice?: number;
  profitPercentage?: number;
  lote?: string;
  fechaVencimiento?: string;
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
        const productType = normalizeProductType(baseData.productType);
        const rules = productTypeRules(productType);
        const dosage = rules.dosage.visible
          ? `${baseData.doseValue || ""} ${baseData.doseUnit || ""}`.trim()
          : undefined;
        const tablets = rules.tablets.visible
          ? `${baseData.amount || ""} ${baseData.presentation || ""}`.trim()
          : undefined;
        const mainImage = imagesList.length > 0 ? imagesList[0].name : "";
        // Un servicio no lleva stock ni mínimo: se omiten en vez de mandar 0.
        const stockQty = rules.stock.visible ? parseInt(baseData.stock) || 0 : undefined;
        const minimumQty = rules.stock.visible ? parseInt(baseData.minimum) || 0 : undefined;
        const lote = rules.stock.visible && typeof baseData.lote === "string" && baseData.lote.trim()
          ? baseData.lote.trim()
          : undefined;
        const fechaVencimiento =
          rules.stock.visible && typeof baseData.fechaVencimiento === "string" && baseData.fechaVencimiento.trim()
            ? baseData.fechaVencimiento.trim()
            : undefined;

        const payloadData: MedicationData = {
          productType,
          brand: baseData.brand || "",
          activeIngredient: rules.activeIngredient.visible ? baseData.activeIngredient || "" : undefined,
          dosage,
          tablets,
          barCode: baseData.barCode || "",
          name: baseData.name || "",
          category: baseData.category || "",
          subcategory: baseData.subcategory || "",
          price: parseFloat(baseData.price) || 0,
          stock: stockQty,
          quantity: stockQty,
          description: baseData.description || "",
          controlled: rules.controlled.visible ? Boolean(baseData.controlled) : undefined,
          // Preserve absence: a blank VAT must not be coerced to an explicit 0,
          // so the inventory row stays NULL and falls back to the catalog/default.
          vat: baseData.vat === undefined || baseData.vat === null || baseData.vat === ""
            ? undefined
            : Number(baseData.vat),
          antibiotic: rules.antibiotic.visible ? Boolean(baseData.antibiotic) : undefined,
          minimum: minimumQty,
          image: mainImage,
          detalle: "",
          discount: baseData.discount !== undefined ? parseFloat(baseData.discount) : undefined,
          basePrice: baseData.basePrice !== undefined ? parseFloat(baseData.basePrice) : undefined,
          profitPercentage: baseData.profitPercentage !== undefined ? parseFloat(baseData.profitPercentage) : undefined,
          lote,
          fechaVencimiento,
        };

        // El lote y el vencimiento son por-farmacia (inventario), no del catálogo universal: se envían solo en el increase.
        // basePrice/profitPercentage tampoco van al catálogo: el backend rechaza el pricing
        // en `/Medications/Create`; el precio se deriva sólo en el inventory write.
        const catalogPayload = {
          ...payloadData,
          basePrice: undefined,
          profitPercentage: undefined,
          lote: undefined,
          fechaVencimiento: undefined,
        };
        const { data: medResult } = await api.post(
          "/Medications/Create",
          [catalogPayload]
        );

        const uploadedImages = await Promise.all(
          imagesList.map((imgFile) =>
            api.post("/admin/MedicationImage/Upload", imgFile).then((res) => res.data)
          )
        );

        // Ligar inventario de la farmacia vía HTTP increase (el backend ya no suscribe insert_inventory por MQTT).
        // El gate es (qty>0 || hasPricing): un alta sin stock pero con precio también debe ligar (PRICING-2).
        // Un fallo de ligado NO debe reportarse como éxito (2.9): se deja propagar al catch externo.
        // Un servicio no tiene inventario (contrato UX): nunca se liga.
        const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
        const quantityVal = payloadData.stock ?? 0;
        const shouldLink = shouldWriteInventory({
          stockDelta: quantityVal,
          submitted: {
            price: payloadData.price,
            minimum: payloadData.minimum ?? 0,
            discount: payloadData.discount,
            basePrice: payloadData.basePrice,
            profitPercentage: payloadData.profitPercentage,
            vat: payloadData.vat,
          },
          existing: null,
        });
        if (rules.stock.visible && pharmacyId && payloadData.barCode && shouldLink) {
          await productsService.increaseInventory(pharmacyId, [
            buildIncreaseItem(
              {
                barCode: payloadData.barCode,
                price: payloadData.price,
                minimum: payloadData.minimum ?? 0,
                discount: payloadData.discount,
                basePrice: payloadData.basePrice,
                profitPercentage: payloadData.profitPercentage,
                vat: payloadData.vat,
                lote: payloadData.lote,
                fechaVencimiento: payloadData.fechaVencimiento,
              },
              quantityVal
            ),
          ]);
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

