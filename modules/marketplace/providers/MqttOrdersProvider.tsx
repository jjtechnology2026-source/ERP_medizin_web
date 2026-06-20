"use client";

/**
 * MqttOrdersProvider.tsx
 * 
 * Orquestador principal de órdenes en tiempo real para el Marketplace.
 * Maneja la conexión MQTT, la cola de órdenes entrantes y el feedback visual global.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { mqttServer } from "@/modules/core/mqtt/advanced-service";
import { MQTT_TOPICS } from "@/modules/core/mqtt/topics";
import { OrderContactAndItems } from "@/proto/interfaces/dto";
import { OrderDto } from "@/proto/interfaces/present";
import { 
  MarketplaceOrderSummary, 
  MqttOrdersContextValue, 
  FeedbackState, 
  FeedbackType 
} from "../types/mqtt-orders";
import { useProductsStore } from "@/modules/products/store/products.store";

const MqttOrdersContext = createContext<MqttOrdersContextValue | null>(null);

// --- Helpers de Decodificación ---

function stringToBinary(payload: string) {
  const bytes = new Uint8Array(payload.length);
  for (let i = 0; i < payload.length; i += 1) {
    bytes[i] = payload.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/** Decodifica usando el DTO de contacto (legado/específico) */
function decodeOrderContactAndItems(payload: Uint8Array): MarketplaceOrderSummary | null {
  try {
    const decoded = OrderContactAndItems.decode(payload);
    return {
      orderId: decoded.orderId,
      clientName: decoded.clientName,
      clientAddress: decoded.clientAddress,
      clientPhone: decoded.clientPhone,
      clientIdNumber: decoded.clientIdNumber,
      items: decoded.items.map((item) => ({
        name: item.barcode,
        barcode: item.barcode,
        quantity: item.quantity,
        price: 0,
      })),
    };
  } catch {
    return null;
  }
}

/** Decodifica usando el DTO estándar de órdenes */
function decodeOrderDto(payload: Uint8Array): MarketplaceOrderSummary | null {
  try {
    const decoded = OrderDto.decode(payload);
    return {
      orderId: decoded.orderId,
      clientName: decoded.client?.name || "Cliente desconocido",
      clientAddress: decoded.client?.address || "Dirección no disponible",
      clientPhone: decoded.client?.phone,
      clientIdNumber: decoded.client?.identity || undefined,
      items: decoded.medicines?.map((item) => ({
        name: item.name || item.barcode || "Producto",
        barcode: item.barcode,
        quantity: item.quantity,
        price: item.price,
      })),
    };
  } catch {
    return null;
  }
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryDecodePayload(payload: Uint8Array) {
  return (
    decodeOrderContactAndItems(payload) ??
    decodeOrderDto(payload) ??
    null
  );
}

/**
 * Normaliza cualquier payload entrante (JSON o Binario) al formato interno.
 */
function normalizeIncomingOrder(payload: Uint8Array | string): MarketplaceOrderSummary | null {
  let parsed: any = null;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      parsed = safeParseJson(trimmed);
    }

    if (!parsed) {
      const binary = stringToBinary(payload);
      parsed = tryDecodePayload(binary);
      if (!parsed) {
        const decodedText = new TextDecoder().decode(binary).trim();
        if (decodedText.startsWith("{") || decodedText.startsWith("[")) {
          parsed = safeParseJson(decodedText);
        }
      }
    }
  } else {
    parsed = tryDecodePayload(payload);
    if (!parsed) {
      const decodedText = new TextDecoder().decode(payload).trim();
      if (decodedText.startsWith("{") || decodedText.startsWith("[")) {
        parsed = safeParseJson(decodedText);
      }
    }
  }

  if (!parsed) return null;
  const orderId = parsed.orderId ?? parsed.order_id ?? parsed.id ?? "";
  if (!orderId) return null;

  // Normalizar items para asegurar que tengan name y price
  const rawItems = parsed.items ?? parsed.medicines ?? [];
    const normalizedItems = Array.isArray(rawItems) ? rawItems.map((item: any) => ({
      name: item.name || item.barcode || "Producto sin nombre",
      barcode: item.barcode || "",
      quantity: item.quantity || 0,
      price: item.price ?? 0,
    })) : [];

    // Si el payload no incluye precios, intentamos rellenarlos desde el inventario local
    try {
      const inventory = useProductsStore.getState().inventory || [];
      for (const ni of normalizedItems) {
        if (!ni.price || Number(ni.price) === 0) {
          const byBarcode = inventory.find((p: any) => p.barCode && ni.barcode && p.barCode === ni.barcode);
          if (byBarcode) {
            ni.price = Number(byBarcode.price) || 0;
            continue;
          }
          const byName = inventory.find((p: any) => p.name && ni.name && p.name.toLowerCase().includes(String(ni.name).toLowerCase()));
          if (byName) {
            ni.price = Number(byName.price) || 0;
          }
        }
      }
    } catch (e) {
      // no bloquear decode si falla la búsqueda en el store
    }

    const total = parsed.total ?? normalizedItems.reduce((acc: number, item: any) => acc + (Number(item.price || 0) * Number(item.quantity || 0)), 0);

  return {
    orderId,
    clientName: parsed.clientName ?? parsed.client_name ?? parsed.client?.name ?? "Cliente desconocido",
    clientAddress: parsed.clientAddress ?? parsed.client_address ?? parsed.client?.address ?? parsed.client?.direccion ?? "N/D",
    clientPhone: parsed.clientPhone ?? parsed.client_phone ?? parsed.client?.phone,
    clientIdNumber: parsed.clientIdNumber ?? parsed.client_id ?? parsed.client?.identity ?? parsed.client?.cedula,
    total,
    items: normalizedItems,
    saleType: parsed.saleType ?? parsed.type_sale ?? "Marketplace",
    createdAt: parsed.createdAt || new Date().toISOString(),
  };
}

import { useNotifications } from "@/modules/core/providers/NotificationProvider";

export function MqttOrdersProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore();
  const { addNotification } = useNotifications();
  const [queuedOrders, setQueuedOrders] = useState<MarketplaceOrderSummary[]>([]);
  const queuedOrdersRef = useRef<MarketplaceOrderSummary[]>([]);
  const subscribedOrderIds = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    queuedOrdersRef.current = queuedOrders;
  }, [queuedOrders]);

  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: "none", title: "", message: "" });

  const currentOrder = useMemo(() => 
    queuedOrders.find(o => o.orderId === focusedOrderId) || null, 
    [queuedOrders, focusedOrderId]
  );

  const clearFeedback = useCallback(() => {
    setFeedback({ type: "none", title: "", message: "" });
  }, []);

  const removeFromQueue = useCallback((orderId: string) => {
    setQueuedOrders((prev) => prev.filter((o) => o.orderId !== orderId));
    if (focusedOrderId === orderId) setFocusedOrderId(null);
  }, [focusedOrderId]);

  /** Lógica de Aceptación */
  const acceptOrder = useCallback(async (orderId?: string) => {
    const id = orderId || focusedOrderId;
    if (!id || !profile?.pharmacyId) return false;

    const topic = MQTT_TOPICS.acceptOrder(profile.pharmacyId, id);
    const success = await mqttServer.publish(topic, JSON.stringify({
      orderId: id,
      pharmacyId: profile.pharmacyId,
      status: "Accepted",
      timestamp: new Date().toISOString()
    }));

    if (success) {
      setFeedback({
        type: "success",
        title: "¡Orden Aceptada!",
        message: "La orden ha sido confirmada exitosamente en el sistema."
      });
      removeFromQueue(id);
    } else {
      setFeedback({
        type: "error",
        title: "Error de Conexión",
        message: "No se pudo notificar al servidor. Por favor, intente de nuevo."
      });
    }
    return success;
  }, [focusedOrderId, profile, removeFromQueue]);

  /** Lógica de Rechazo */
  const rejectOrder = useCallback(async (orderId?: string, reason: string = "Cancelada por farmacia") => {
    const id = orderId || focusedOrderId;
    if (!id || !profile?.pharmacyId) return false;

    const topic = MQTT_TOPICS.rejectOrder(profile.pharmacyId, id);
    const success = await mqttServer.publish(topic, JSON.stringify({
      orderId: id,
      pharmacyId: profile.pharmacyId,
      status: "Rejected",
      reason
    }));

    if (success) {
      setFeedback({
        type: "success", 
        title: "Orden Rechazada",
        message: "La orden ha sido cancelada y retirada de tu cola."
      });
      removeFromQueue(id);
    }
    return success;
  }, [focusedOrderId, profile, removeFromQueue]);

  const dismissOrder = useCallback(() => {
    setFocusedOrderId(null);
  }, []);

  const focusOrder = useCallback((orderId: string) => {
    setFocusedOrderId(orderId);
    setSecondsLeft(60); // Reset timer when focusing
  }, []);

  // --- Efectos de Conexión y Mensajes ---

  useEffect(() => {
    if (!profile?.pharmacyId) return;

    const unsubConnection = mqttServer.onConnectionChange((connected) => {
      setMqttConnected(connected);
      if (connected) {
        mqttServer.subscribeToMarketplace(profile.pharmacyId).catch(() => {});
        mqttServer.subscribeToInventory(profile.pharmacyId).catch(() => {});
      }
    });

    const unsubMessage = mqttServer.onMessage((topic, payload) => {
      // ── PAGO ACEPTADO: orden pagada por el cliente ──────────────────────────
      if (topic.includes("/payment_accepted") || topic.includes("/accepted_delivery")) {
        const orderId = topic.split("/")[1]; // order_id/{orderId}/payment_accepted
        if (!orderId) return;

        addNotification({
          type: 'order',
          title: 'Pago confirmado',
          message: `El pago de la orden #${orderId.slice(-8)} ha sido confirmado`,
          orderId
        });

        // Remover de la cola de pendientes
        setQueuedOrders((prev) => prev.filter((o) => o.orderId !== orderId));

        // Descontar inventario local (como en Dart: publish remove_inventory + applyInventoryUpdate)
        const order = queuedOrdersRef.current.find((o) => o.orderId === orderId);
        if (order?.items?.length) {
          const stockUpdates = order.items.map((item) => ({
            barCode: item.barcode || "",
            stock: 0, // Se marcará como vendido
          })).filter((u) => u.barCode);

          if (stockUpdates.length > 0) {
            // Descontar stock local
            useProductsStore.getState().decrementStock(
              order.items.map((item) => ({
                barCode: item.barcode || "",
                quantity: item.quantity,
              })).filter((u) => u.barCode)
            );

          }
        }

        setFeedback({
          type: "success",
          title: "¡Pago Confirmado!",
          message: `El pago de la orden #${orderId.slice(-8)} ha sido procesado. Stock actualizado.`
        });
        return;
      }

      // ── NUEVA ORDEN ENTRANTE ──────────────────────────────────────────────
      if (profile?.pharmacyId && topic === MQTT_TOPICS.marketplacePharmacy(profile.pharmacyId)) {
        const normalized = normalizeIncomingOrder(payload);
        if (!normalized) return;

        // Añadimos la orden solo después de intentar rellenar precios.
        (async () => {
          try {
            const needsPrice = (normalized.items || []).some((it) => !it.price || Number(it.price) === 0);
            const productsState = useProductsStore.getState();
            if (needsPrice) {
              // Si no tenemos inventario local, forcemos una carga
              if (!productsState.inventory || productsState.inventory.length === 0) {
                try {
                  await productsState.fetchInventory(true);
                } catch {
                  // ignore fetch errors
                }
              }

              // Rellenar precios desde inventario (barcode -> exact match, luego name fuzzy)
              const inv = useProductsStore.getState().inventory || [];
              for (const ni of (normalized.items || [])) {
                if (!ni.price || Number(ni.price) === 0) {
                  const byBarcode = inv.find((p: any) => p.barCode && ni.barcode && p.barCode === ni.barcode);
                  if (byBarcode) {
                    ni.price = Number(byBarcode.price) || 0;
                    continue;
                  }
                  const byName = inv.find((p: any) => p.name && ni.name && p.name.toLowerCase() === String(ni.name).toLowerCase());
                  if (byName) {
                    ni.price = Number(byName.price) || 0;
                    continue;
                  }
                  // fuzzy fallback
                  const byNameContain = inv.find((p: any) => p.name && ni.name && p.name.toLowerCase().includes(String(ni.name).toLowerCase()));
                  if (byNameContain) ni.price = Number(byNameContain.price) || 0;
                }
              }
            }

            addNotification({
              type: 'order',
              title: 'Nuevo pedido',
              message: `Se ha registrado un nuevo pedido de ${normalized.clientName} (#${normalized.orderId.slice(-8)})`,
              orderId: normalized.orderId
            });

            setQueuedOrders((prev) => {
              if (prev.some((o) => o.orderId === normalized.orderId)) return prev;
              const newQueue = [...prev, normalized];
              if (!focusedOrderId) setFocusedOrderId(normalized.orderId);
              return newQueue;
            });
            setSecondsLeft(60);
          } catch (e) {
            // en caso de fallo, encolamos la orden sin precios para no perderla
            setQueuedOrders((prev) => {
              if (prev.some((o) => o.orderId === normalized.orderId)) return prev;
              const newQueue = [...prev, normalized];
              if (!focusedOrderId) setFocusedOrderId(normalized.orderId);
              return newQueue;
            });
            setSecondsLeft(60);
          }
        })();
      }
    });

    mqttServer.subscribeToMarketplace(profile.pharmacyId).catch(() => {});
    mqttServer.subscribeToInventory(profile.pharmacyId).catch(() => {});

    return () => {
      unsubConnection();
      unsubMessage();
    };
  }, [profile]);

  // Sync per-order payment/accepted_delivery subscriptions
  useEffect(() => {
    const currentIds = new Set(queuedOrders.map((o) => o.orderId));

    currentIds.forEach((orderId) => {
      if (!subscribedOrderIds.current.has(orderId)) {
        subscribedOrderIds.current.add(orderId);
        mqttServer.subscribe([
          MQTT_TOPICS.paymentAccepted(orderId),
          MQTT_TOPICS.acceptedDelivery(orderId),
        ]).catch(() => {});
      }
    });

    subscribedOrderIds.current.forEach((orderId) => {
      if (!currentIds.has(orderId)) {
        subscribedOrderIds.current.delete(orderId);
        mqttServer.unsubscribe([
          MQTT_TOPICS.paymentAccepted(orderId),
          MQTT_TOPICS.acceptedDelivery(orderId),
        ]).catch(() => {});
      }
    });
  }, [queuedOrders]);

  // Timer para la orden actual
  useEffect(() => {
    if (!focusedOrderId) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [focusedOrderId]);

  const value = useMemo(() => ({
    queuedOrders,
    currentOrder,
    mqttConnected,
    acceptOrder,
    rejectOrder,
    dismissOrder,
    focusOrder,
    removeFromQueue,
    secondsLeft,
    feedback,
    clearFeedback,
  }), [
    queuedOrders,
    currentOrder,
    mqttConnected,
    acceptOrder,
    rejectOrder,
    dismissOrder,
    focusOrder,
    removeFromQueue,
    secondsLeft,
    feedback,
    clearFeedback,
  ]);

  return (
    <MqttOrdersContext.Provider value={value}>
      {children}
    </MqttOrdersContext.Provider>
  );
}

export function useMqttOrders() {
  const context = useContext(MqttOrdersContext);
  if (!context) {
    throw new Error("useMqttOrders must be used within a MqttOrdersProvider");
  }
  return context;
}
