import { DtoUpdateMedications } from "@/proto/interfaces/dto";
import { MQTT_TOPICS } from "@/modules/core/mqtt/topics";
import { mqttServer } from "@/modules/core/mqtt/advanced-service";

export function setupInventoryMqttHandler(pharmacyId: string): (() => void) | null {
  if (!pharmacyId) return null;

  const unsub = mqttServer.onMessage((topic, payload) => {
    if (topic === MQTT_TOPICS.inventoryUpdate(pharmacyId)) {
      try {
        const data = DtoUpdateMedications.decode(
          typeof payload === "string" ? new TextEncoder().encode(payload) : payload
        );
        const { useProductsStore } = require("@/modules/products/store/products.store");
        const updates = (data.medications ?? []).map((m: any) => ({
          barCode: m.barCode ?? "",
          stock: m.stock ?? 0,
        }));
        useProductsStore.getState().applyInventoryUpdate(updates);
      } catch {
        // ignore decode errors
      }
    }

    if (topic === MQTT_TOPICS.inventoryRemove(pharmacyId)) {
      try {
        const data = DtoUpdateMedications.decode(
          typeof payload === "string" ? new TextEncoder().encode(payload) : payload
        );
        const { useProductsStore } = require("@/modules/products/store/products.store");
        const items = (data.medications ?? []).map((m: any) => ({
          barCode: m.barCode ?? "",
          quantity: m.quantity ?? 1,
        }));
        useProductsStore.getState().decrementStock(items);
      } catch {
        // ignore decode errors
      }
    }
  });

  return unsub;
}
