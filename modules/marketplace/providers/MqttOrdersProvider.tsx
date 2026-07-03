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
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { addChatMessage } from "@/modules/core/store/chat.store";
import { useChatToast } from "@/modules/core/providers/ChatToastProvider";
import api from "@/modules/core/api/client";

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
      saleType: ((decoded as any).type_sale || (decoded as any).saleType) ?? undefined,
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
      saleType: ((decoded as any).type_sale || (decoded as any).saleType) ?? undefined,
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
    saleType: parsed.saleType ?? parsed.type_sale ?? "Pickup",
    createdAt: parsed.createdAt || new Date().toISOString(),
  };
}

import { useNotifications } from "@/modules/core/providers/NotificationProvider";

export function MqttOrdersProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore();
  const { addNotification } = useNotifications();
  const chatToast = useChatToast();
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
  const [mqttError, setMqttError] = useState<string | null>(null);

  const currentOrder = useMemo(() => 
    queuedOrders.find(o => o.orderId === focusedOrderId) || null, 
    [queuedOrders, focusedOrderId]
  );

  const clearFeedback = useCallback(() => {
    setFeedback({ type: "none", title: "", message: "" });
  }, []);

  const clearMqttError = useCallback(() => {
    setMqttError(null);
  }, []);

  const removeFromQueue = useCallback((orderId: string) => {
    setQueuedOrders((prev) => prev.filter((o) => o.orderId !== orderId));
    if (focusedOrderId === orderId) setFocusedOrderId(null);
  }, [focusedOrderId]);

  /** Lógica de Aceptación (desde el diálogo MQTT) */
  const acceptOrder = useCallback(async (orderId?: string) => {
    const id = orderId || focusedOrderId;
    if (!id || !profile?.pharmacyId) return false;

    const topic = MQTT_TOPICS.acceptOrder(profile.pharmacyId, id);
    const success = await mqttServer.publish(topic, JSON.stringify({
      orderId: id,
      pharmacyId: profile.pharmacyId,
      status: "Accepted",
      timestamp: new Date().toISOString(),
      id_agent: profile.id_agent || "",
      name_agent: profile.name_agent || "",
      id_group: profile.id_group || "",
      name_group: profile.name_group || "",
      rif_emisor: profile.rif_emisor || "",
    }), (profile as any)?.id_agent);

    if (success) {
      mqttServer.subscribe(MQTT_TOPICS.clientToPharmacy(id), (profile as any)?.id_agent).catch(() => {});
      setFeedback({
        type: "success",
        title: "¡Orden Aceptada!",
        message: "La orden ha sido confirmada exitosamente en el sistema."
      });
      setFocusedOrderId(null);
    } else {
      setFeedback({
        type: "error",
        title: "Error de Conexión",
        message: "No se pudo notificar al servidor. Por favor, intente de nuevo."
      });
    }
    return success;
  }, [focusedOrderId, profile]);

  /** Lógica de Finalización (desde la tabla) */
  const finalizeOrder = useCallback(async (orderId?: string) => {
    const id = orderId || focusedOrderId;
    if (!id || !profile?.pharmacyId) return false;

    const success = await mqttServer.publish(
      MQTT_TOPICS.completedOrder(id),
      JSON.stringify({
        orderId: id,
        pharmacyId: profile.pharmacyId,
        timestamp: new Date().toISOString(),
      }),
      (profile as any)?.id_agent
    );

    if (success) {
      setFeedback({
        type: "success",
        title: "¡Orden Finalizada!",
        message: "La orden ha sido completada exitosamente."
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
    }), (profile as any)?.id_agent);

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
        setMqttError(null);
        mqttServer.subscribeToMarketplace(profile.pharmacyId, (profile as any)?.id_agent).catch(() => {});
        mqttServer.subscribeToInventory(profile.pharmacyId, (profile as any)?.id_agent).catch(() => {});
      }
    });

    const unsubError = mqttServer.onError((message) => {
      setMqttError(message);
      addNotification({
        type: 'error',
        title: 'Error MQTT',
        message,
      } as any);
    });

    const unsubMessage = mqttServer.onMessage((topic, payload) => {
      // ── PAGO ACEPTADO: orden pagada por el cliente ──────────────────────────
      if (topic.includes("/payment_accepted")) {
        const orderId = topic.split("/")[1]; // order_id/{orderId}/payment_accepted
        if (!orderId) return;

        const order = queuedOrdersRef.current.find((o) => o.orderId === orderId);
        if (!order?.items?.length) {
          setQueuedOrders((prev) => prev.filter((o) => o.orderId !== orderId));
          return;
        }

        // Notificar
        addNotification({
          type: 'order',
          title: 'Pago confirmado',
          message: `El pago de la orden #${orderId.slice(-8)} ha sido confirmado`,
          orderId
        });

        // Construir orden completa y enviar al backend
        (async () => {
          try {
            const sessionResponse = await api.get("/admin/sesiones/activa");
            const sesionCajaId = sessionResponse.data?.data?.sesion?.id;
            if (!sesionCajaId) {
              console.error("[MqttOrdersProvider] No hay sesión de caja activa — orden queda en cola");
              setFeedback({
                type: "error",
                title: "Sin sesión de caja",
                message: "No hay una sesión de caja activa. Abrí una caja para procesar órdenes de marketplace.",
              });
              return;
            }

            const inventory = useProductsStore.getState().inventory || [];
            const rate = useCurrencyStore.getState().getEffectiveRate();

            const medications = order.items!.map((item) => {
              const full = inventory.find((p: any) => p.barCode && p.barCode === item.barcode);
              return {
                barCode: item.barcode || "",
                name: full?.name || item.name || "",
                price: full?.price ?? item.price ?? 0,
                quantity: item.quantity,
                brand: full?.brand || "",
                activeIngredient: full?.activeIngredient || "",
                dosage: full?.dosage || "",
                tablets: full?.tablets || "",
                image: full?.image || "",
                category: full?.category || "",
                subcategory: full?.subcategory || "",
                stock: full?.stock ?? 0,
                description: full?.description || "",
                controlled: full?.controlled || false,
                vat: full?.vat ?? 16,
                antibiotic: full?.antibiotic || false,
                minimum: full?.minimum || 0,
              };
            });

            const subtotalUSD = medications.reduce((s, m) => s + m.price * m.quantity, 0);
            const totalVES = Math.round(subtotalUSD * rate * 100) / 100;

            const modelOrder = {
              date: new Date().toISOString(),
              id: orderId,
              nameGroup: profile?.name_group || "",
              idAgent: (profile as any)?.id_agent || (profile as any)?.agentId || profile?.id || "",
              nameAgent: profile?.name || "",
              idPharmacy: profile?.pharmacyId || "",
              idGroup: profile?.id_group || "",
              pharmacy: profile?.pharmacyName || "",
              medications,
              totalreal: subtotalUSD,
              totalsystem: subtotalUSD,
              rate,
              payments: [{
                method: "mobile",
                amount: totalVES,
                reference: "",
                bank: ""
              }],
              changes: [],
              totalPaidIn: totalVES,
              totalChangeOut: 0,
              rifEmisor: (profile as any)?.rif || "J-00000000-0",
              client: {
                id: "",
                documento: order.clientIdNumber || "V-00000000",
                name: order.clientName || "Cliente Marketplace",
                email: "",
                direccion: order.clientAddress || "",
                phone: order.clientPhone || "0000000000",
                retencion: 0,
                tipo_documento: (order.clientIdNumber?.match(/^[A-Za-z]/)?.[0]?.toUpperCase()) || "V",
              },
              facturacion: null,
              notaCredito: null,
              notaDebito: null,
              numeroControlInterno: null,
              gender: "Male",
              saleStatus: "Completed",
              isControlled: medications.some((m) => m.controlled),
              saleType: order.saleType || "Pickup",
              address: order.clientAddress || "",
              observation: null,
              delivery: null,
            };

            const url = `/admin/Orders/insertorder?sesion_caja_id=${encodeURIComponent(sesionCajaId)}`;
            await api.post(url, [modelOrder]);

            // Descontar stock local
            useProductsStore.getState().decrementStock(
              order.items!.map((item) => ({
                barCode: item.barcode || "",
                quantity: item.quantity,
              })).filter((u) => u.barCode)
            );

            // Limpiar cola
            setQueuedOrders((prev) => prev.filter((o) => o.orderId !== orderId));

            setFeedback({
              type: "success",
              title: "¡Pago Confirmado!",
              message: `La orden #${orderId.slice(-8)} fue registrada. Stock actualizado.`
            });
          } catch (e: any) {
            console.error("[MqttOrdersProvider] insertorder falló", e?.response?.status, e?.response?.data);
          }
        })();
        return;
      }

      // ── ENTREGA ACEPTADA: solo feedback ──────────────────────────────────
      if (topic.includes("/accepted_delivery")) {
        const orderId = topic.split("/")[1];
        if (!orderId) return;

        addNotification({
          type: 'order',
          title: 'Entrega confirmada',
          message: `La entrega de la orden #${orderId.slice(-8)} ha sido confirmada`,
          orderId
        });

        setQueuedOrders((prev) => prev.filter((o) => o.orderId !== orderId));
        return;
      }

      // ── ORDEN COMPLETADA (por otro sistema) ─────────────────────────────
      if (topic.includes("/completed")) {
        const orderId = topic.split("/")[1];
        if (!orderId) return;

        addNotification({
          type: 'order',
          title: 'Orden completada',
          message: `La orden #${orderId.slice(-8)} ha sido completada externamente`,
          orderId
        });

        setFeedback({
          type: "success",
          title: "¡Orden Completada!",
          message: `La orden #${orderId.slice(-8)} ha sido completada.`
        });
        removeFromQueue(orderId);
        return;
      }

      // ── MENSAJE DE CHAT (cliente → farmacia) ─────────────────────────────
      if (topic.endsWith("/cliente/message_pharmacy_send")) {
        try {
          const raw = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
          const data = JSON.parse(raw);
          if (data.text) {
            const orderId = topic.split("/")[1];
            addChatMessage(orderId, { text: data.text, sender: "client", timestamp: data.timestamp || Date.now() });
            chatToast.show(`Cliente: ${data.text.slice(0, 80)}`);
          }
        } catch {}
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

    mqttServer.subscribeToMarketplace(profile.pharmacyId, (profile as any)?.id_agent).catch(() => {});
    mqttServer.subscribeToInventory(profile.pharmacyId, (profile as any)?.id_agent).catch(() => {});

    return () => {
      unsubConnection();
      unsubError();
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
          MQTT_TOPICS.completedOrder(orderId),
        ], (profile as any)?.id_agent).catch(() => {});
      }
    });

    subscribedOrderIds.current.forEach((orderId) => {
      if (!currentIds.has(orderId)) {
        subscribedOrderIds.current.delete(orderId);
        mqttServer.unsubscribe([
          MQTT_TOPICS.paymentAccepted(orderId),
          MQTT_TOPICS.acceptedDelivery(orderId),
          MQTT_TOPICS.completedOrder(orderId),
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
    finalizeOrder,
    rejectOrder,
    dismissOrder,
    focusOrder,
    removeFromQueue,
    secondsLeft,
    feedback,
    clearFeedback,
    mqttError,
    clearMqttError,
  }), [
    queuedOrders,
    currentOrder,
    mqttConnected,
    acceptOrder,
    finalizeOrder,
    rejectOrder,
    dismissOrder,
    focusOrder,
    removeFromQueue,
    secondsLeft,
    feedback,
    clearFeedback,
    mqttError,
    clearMqttError,
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
