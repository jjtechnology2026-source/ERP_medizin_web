"use client";

/**
 * MqttInventoryProvider.tsx
 *
 * Equivalent to Dart's MqttInventoryManager.
 * Listens to MQTT inventory topics and syncs the local inventory store
 * in real-time — exactly like the Dart app does.
 *
 * Topics watched (per Dart app documentation):
 *   - pharmacy/{pharmacyId}/insert_inventory  → add/upsert medications
 *   - pharmacy/{pharmacyId}/update_inventory  → update medications
 *   - pharmacy/{pharmacyId}/remove_inventory  → reduce stock after sale
 *
 * Payload format:
 *   Protobuf: DtoUpdateMedications { idAgent, idPharmacy, medications: MedicationProto[] }
 */

import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { mqttServer } from "@/modules/core/mqtt/advanced-service";
import { MQTT_TOPICS } from "@/modules/core/mqtt/topics";
import { DtoUpdateMedications } from "@/proto/interfaces/dto";
import { useProductsStore } from "@/modules/products/store/products.store";
import type { Medication } from "@/modules/products/types/products.types";

// ─── Context (simple marker so we don't mount twice) ────────────────────────
const MqttInventoryContext = createContext<boolean>(false);

// ─── Helpers ────────────────────────────────────────────────────────────────

function payloadToUint8Array(payload: Uint8Array | string): Uint8Array {
  if (typeof payload !== "string") return payload;
  const bytes = new Uint8Array(payload.length);
  for (let i = 0; i < payload.length; i++) {
    bytes[i] = payload.charCodeAt(i) & 0xff;
  }
  return bytes;
}

type MedicationProtoLike = DtoUpdateMedications["medications"][0];

/** Convert a MedicationProto to our internal Medication type */
function protoToMedication(proto: MedicationProtoLike): Medication {
  return {
    brand: proto.brand || "",
    activeIngredient: proto.activeIngredient || "",
    dosage: proto.dosage || "",
    tablets: proto.tablets || "",
    barCode: proto.barCode || "",
    name: proto.name || "",
    image: proto.image || "",
    category: proto.category || "",
    subcategory: proto.subcategory || "",
    price: typeof proto.price === "number" ? proto.price : 0,
    quantity: typeof proto.quantity === "number" ? proto.quantity : 0,
    stock: (typeof proto.stock === "number" && proto.stock > 0)
        ? proto.stock
        : (typeof proto.quantity === "number" ? proto.quantity : 0),
    description: proto.description || "",
    controlled: !!proto.controlled,
    vat: typeof proto.vat === "number" ? proto.vat : 16,
    antibiotic: !!proto.antibiotic,
    minimum: typeof proto.minimum === "number" ? proto.minimum : 0,
  };
}

/** Try to decode a protobuf DtoUpdateMedications payload */
function tryDecodeDtoUpdateMedications(raw: Uint8Array): DtoUpdateMedications | null {
  try {
    const decoded = DtoUpdateMedications.decode(raw);
    if (decoded.medications && decoded.medications.length > 0) return decoded;
    return null;
  } catch {
    return null;
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function MqttInventoryProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuthStore();
  const { fetchInventory } = useProductsStore();
  const initialFetchDone = useRef(false);

  // 1. Initial REST load — same as Dart does on startup
  useEffect(() => {
    if (profile?.pharmacyId && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchInventory();
    }
  }, [profile?.pharmacyId, fetchInventory]);

  // 2. MQTT real-time sync — mirrors Dart's MqttInventoryManager
  useEffect(() => {
    if (!profile?.pharmacyId) return;

    const pharmacyId = profile.pharmacyId;

    // Ensure subscriptions (idempotent — safe to call even if already subscribed)
    mqttServer.subscribeToInventory(pharmacyId).catch(() => {});

    const unsubMessage = mqttServer.onMessage((topic, rawPayload) => {
      const payload = payloadToUint8Array(rawPayload);

      // ── INSERT / UPDATE: upsert full medication list ──────────────────────
      const isInsert = topic === MQTT_TOPICS.inventoryInsert(pharmacyId);
      const isUpdate = topic === MQTT_TOPICS.inventoryUpdate(pharmacyId);

      if (isInsert || isUpdate) {
        const dto = tryDecodeDtoUpdateMedications(payload);
        if (!dto) return;

        const updates = dto.medications.map(protoToMedication);

        useProductsStore.setState((state) => {
          const inventoryMap = new Map(state.inventory.map((m) => [m.barCode, m]));
          updates.forEach((med) => {
            inventoryMap.set(med.barCode, {
              ...(inventoryMap.get(med.barCode) || {}),
              ...med,
            });
          });
          return { inventory: Array.from(inventoryMap.values()) };
        });
        return;
      }

      // ── REMOVE: reduce stock after a sale ────────────────────────────────
      // quantity = unidades vendidas, se descuenta del stock actual
      if (topic === MQTT_TOPICS.inventoryRemove(pharmacyId)) {
        const dto = tryDecodeDtoUpdateMedications(payload);
        if (!dto) return;

        const items = dto.medications.map((med) => ({
          barCode: med.barCode ?? "",
          quantity: typeof med.quantity === "number" ? med.quantity : 1,
        }));

        useProductsStore.getState().decrementStock(items);
        return;
      }
    });

    return () => {
      unsubMessage();
    };
  }, [profile?.pharmacyId]);

  return (
    <MqttInventoryContext.Provider value={true}>
      {children}
    </MqttInventoryContext.Provider>
  );
}

export function useMqttInventory() {
  return useContext(MqttInventoryContext);
}
