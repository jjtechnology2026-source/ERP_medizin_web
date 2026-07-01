import mqtt, { MqttClient, IClientOptions } from "mqtt";
import { OrderDto } from "@/proto/interfaces/present";
import { OrderContactAndItems } from "@/proto/interfaces/dto";
import { MQTT_TOPICS } from "./topics";

function normalizePayloadText(payload: Uint8Array | string) {
  return typeof payload === "string" ? payload : new TextDecoder().decode(payload);
}

function payloadToUint8Array(payload: Uint8Array | string) {
  if (typeof payload !== "string") return payload;
  const bytes = new Uint8Array(payload.length);
  for (let i = 0; i < payload.length; i += 1) {
    bytes[i] = payload.charCodeAt(i) & 0xff;
  }
  return bytes;
}

// ─── Singleton global (v1) ──────────────────────────────────────────────────
const g = global as typeof global & { _mqttSrv_v1?: MqttServerService };

class MqttServerService {
  private client: MqttClient | null = null;
  private connecting: Promise<MqttClient> | null = null;
  private store = new Map<string, Record<string, unknown>>();
  private authFailed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private lastPharmacyId: string | undefined;
  private lastAgentId: string | undefined;

  private activeSubscriptions = new Set<string>();
  private runtimeConfig: any = null;

  private connectionHandlers: Set<(connected: boolean) => void> = new Set();
  private messageHandlers: Set<(topic: string, payload: Uint8Array | string) => void> = new Set();
  private errorHandlers: Set<(message: string) => void> = new Set();

  static get(): MqttServerService {
    if (!g._mqttSrv_v1) {
      g._mqttSrv_v1 = new MqttServerService();
    }
    return g._mqttSrv_v1;
  }

  /** Reemplaza TODOS los handlers (legacy) */
  setHandlers(connectionChangeHandler?: (connected: boolean) => void, messageHandler?: (topic: string, payload: Uint8Array | string) => void) {
    this.connectionHandlers.clear();
    this.messageHandlers.clear();
    if (connectionChangeHandler) this.connectionHandlers.add(connectionChangeHandler);
    if (messageHandler) this.messageHandlers.add(messageHandler);
  }

  /** Agrega un handler de conexión sin eliminar los existentes */
  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  /** Agrega un handler de mensajes sin eliminar los existentes */
  onMessage(handler: (topic: string, payload: Uint8Array | string) => void) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /** Agrega un handler de error para exponer fallos al usuario */
  onError(handler: (message: string) => void) {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  private notifyError(message: string) {
    this.errorHandlers.forEach((h) => { try { h(message); } catch {} });
  }

  private notifyDisconnected() {
    this.connectionHandlers.forEach((h) => { try { h(false); } catch {} });
  }

  private notifyConnected() {
    this.connectionHandlers.forEach((h) => { try { h(true); } catch {} });
  }

  private log(level: "log" | "warn" | "error", msg: string, ...args: any[]) {
    console[level](msg, ...args);
  }

  /** Limpiar reconexión pendiente */
  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private rapidReconnectCount = 0;
  private rapidReconnectWindow = 0;

  /** Programar re-conexión manual con backoff exponencial (máx 30s) y circuit breaker */
  private scheduleReconnect() {
    if (this.authFailed) {
      return;
    }
    this.clearReconnectTimer();

    const now = Date.now();
    if (now - this.rapidReconnectWindow > 15_000) {
      this.rapidReconnectCount = 0;
      this.rapidReconnectWindow = now;
    }
    this.rapidReconnectCount++;

    let delay: number;
    if (this.rapidReconnectCount > 3) {
      delay = 30_000;
      this.log("warn", `>>> [MQTT:RECONNECT] Circuit breaker: ${this.rapidReconnectCount} reconexiones en ${Math.round((now - this.rapidReconnectWindow) / 1000)}s, esperando ${delay / 1000}s`);
      this.notifyError("Problemas de conexión MQTT. Reintentando en breve...");
    } else {
      delay = Math.min(3_000 * Math.pow(1.5, this.reconnectAttempts), 30_000);
    }

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connecting = null;
      this.client = null;
      this.connect(this.lastPharmacyId).catch((e) => this.log("error", e.message));
    }, delay);
  }

  /** Helper para timeouts en promesas */
  private async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout: ${label} tras ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]);
  }

  private connect(pharmacyId?: string, agentId?: string): Promise<MqttClient> {
    if (this.authFailed) {
      return Promise.reject(new Error("MQTT: Autenticación fallida — revisa las credenciales."));
    }
    if (this.client?.connected) return Promise.resolve(this.client);
    if (this.connecting) return this.connecting;

    if (pharmacyId) this.lastPharmacyId = pharmacyId;
    if (agentId) this.lastAgentId = agentId;

    const isServer = typeof window === "undefined";

    const host = this.runtimeConfig?.EMQX_BROKER || process.env.NEXT_PUBLIC_MQTT_BROKER_HOST;
    const wssUrl = this.runtimeConfig?.MQTT_URL || process.env.NEXT_PUBLIC_MQTT_URL;
    const port = this.runtimeConfig?.EMQX_PORT || process.env.NEXT_PUBLIC_MQTT_BROKER_PORT;
    const username = this.runtimeConfig?.EMQX_USER || process.env.NEXT_PUBLIC_MQTT_USERNAME;
    const password = this.runtimeConfig?.EMQX_PASS || process.env.NEXT_PUBLIC_MQTT_PASSWORD;

    const finalUrl = isServer ? `mqtt://${host}:${port}` : wssUrl || `wss://${host}:${port}/mqtt`;

    if (!finalUrl || finalUrl.includes("undefined") || finalUrl === "mqtt://undefined:undefined") {
      const err = "MQTT config missing (URL/Host/Port)";
      this.log("error", "[MQTT] Error: URL de conexión inválida o no configurada.");
      this.notifyError(err);
      return Promise.reject(new Error(err));
    }

    const uid = Math.random().toString(36).slice(2, 8);
    const clientId = `medizin_terminal_${agentId || this.lastAgentId || "unknown"}_${uid}`;

    this.log("log", `\n>>> [MQTT:CONNECT] Conectando (${isServer ? "SERVER" : "CLIENT"}): ${finalUrl} clientId=${clientId}`);

    const connectPromise = new Promise<MqttClient>((resolve, reject) => {
      const opts: IClientOptions = {
        protocolVersion: 5,
        clientId,
        clean: true,
        connectTimeout: 10_000,
        reconnectPeriod: 0,
        keepalive: 60,
        username: username,
        password: password,
        rejectUnauthorized: false,
      };

      const c = mqtt.connect(finalUrl, opts);

      let settled = false;

    c.once("connect", (connack) => {
        settled = true;
        this.client = c;
        this.connecting = null;
        this.reconnectAttempts = 0;
        this.rapidReconnectCount = 0;
        this.clearReconnectTimer();
        this.log("log", ">>> [MQTT:CONNECT] Servidor Conectado y Autenticado");
        this.notifyConnected();

        if (this.activeSubscriptions.size > 0) {
          const topics = Array.from(this.activeSubscriptions);
          if (isServer) {
            this.log("log", `>>> [MQTT:RESTORE] Re-suscribiendo a ${topics.length} tópicos...`);
          }
          c.subscribe(topics, { qos: 1 });
        }
        resolve(c);
      });

      c.on("message", this._handleIncomingMessage.bind(this));

      c.on("error", (err) => {
        this.log("error", ">>> [MQTT:ERROR] ", err.message);

        const msg = err.message.toLowerCase();
        if (
          msg.includes("bad user name") ||
          msg.includes("not authorized") ||
          msg.includes("connection refused: 4") ||
          msg.includes("connection refused: 5")
        ) {
            this.log("error", ">>> [MQTT:AUTH] Error de credenciales. Se detiene la reconexión. Reintentando en 30s...");
          this.authFailed = true;
          this.notifyError("Error de autenticación MQTT. Reintentando en 30 segundos...");
          setTimeout(() => this.resetAuthFailure(), 30_000);
          c.end(true);
          if (!settled) {
            settled = true;
            this.connecting = null;
            reject(err);
          }
          return;
        }

        if (!settled) {
          settled = true;
          this.connecting = null;
          reject(err);
        }
      });

      c.on("close", () => {
        if (this.authFailed) return;
        this.log("warn", ">>> [MQTT:CONN] Conexión cerrada. Programando reconexión...");
        this.client = null;
        this.notifyDisconnected();
        if (!settled) {
          settled = true;
          this.connecting = null;
          reject(new Error("Connection closed before established"));
        }
        this.scheduleReconnect();
      });


    });

    this.connecting = this.withTimeout(connectPromise, 20_000, "Conexión MQTT");
    return this.connecting;
  }

  async subscribeToInventory(pharmacyId: string, agentId?: string): Promise<void> {
    const topics = [
      MQTT_TOPICS.inventoryInsert(pharmacyId),
      MQTT_TOPICS.inventoryUpdate(pharmacyId),
      MQTT_TOPICS.inventoryRemove(pharmacyId),
    ];
    const client = await this.connect(pharmacyId, agentId);
    topics.forEach((t) => this.activeSubscriptions.add(t));

    this.log("log", `\n>>> [MQTT:SUB] Suscribiendo inventario para: ${pharmacyId}`);

    return this.withTimeout(
      new Promise<void>((resolve, reject) => {
        client.subscribe(topics, { qos: 1 }, (err) => {
          if (err) {
            this.log("error", ">>> [MQTT:SUB_INVENTORY_FAIL]", err.message);
            reject(err);
          } else {
            this.log("log", ">>> [MQTT:SUB_INVENTORY_OK] Inventario suscrito");
            resolve();
          }
        });
      }),
      10_000,
      `Suscripción MQTT Inventario (${pharmacyId})`,
    );
  }

  async subscribeToMarketplace(pharmacyId: string, agentId?: string): Promise<void> {
    const topics = [MQTT_TOPICS.marketplacePharmacy(pharmacyId)];

    const client = await this.connect(pharmacyId, agentId);

    topics.forEach((t) => this.activeSubscriptions.add(t));

    this.log("log", `\n>>> [MQTT:SUB] Armando escucha para Marketplace: ${pharmacyId}`);

    return this.withTimeout(
      new Promise<void>((resolve, reject) => {
        client.subscribe(topics, { qos: 1 }, (err) => {
          if (err) {
            this.log("error", ">>> [MQTT:SUB_FAIL]", err.message);
            reject(err);
          } else {
            this.log("log", ">>> [MQTT:SUB_OK] Suscripción confirmada");
            resolve();
          }
        });
      }),
      10_000,
      `Suscripción MQTT Marketplace (${pharmacyId})`,
    );
  }

  async subscribe(topics: string | string[], agentId?: string): Promise<void> {
    const topicList = Array.isArray(topics) ? topics : [topics];

    const client = await this.connect(undefined, agentId);
    topicList.forEach((t) => this.activeSubscriptions.add(t));

    return this.withTimeout(
      new Promise<void>((resolve, reject) => {
        client.subscribe(topicList, { qos: 1 }, (err) => {
          if (err) {
            this.log("error", ">>> [MQTT:SUB_GENERIC_FAIL]", err.message);
            reject(err);
          } else {
            this.log("log", `>>> [MQTT:SUB_GENERIC_OK] Suscrito a: ${topicList.join(", ")}`);
            resolve();
          }
        });
      }),
      10_000,
              `Suscripción MQTT Genérica (${topicList.join(", ")})`,
    );
  }

  async unsubscribe(topics: string | string[]): Promise<void> {
    const topicList = Array.isArray(topics) ? topics : [topics];
    if (!topicList.length || !this.client) return;

    topicList.forEach((t) => this.activeSubscriptions.delete(t));

    return this.withTimeout(
      new Promise<void>((resolve) => {
        this.client!.unsubscribe(topicList, undefined, () => {
          this.log("log", `>>> [MQTT:UNSUB] Desuscrito de: ${topicList.join(", ")}`);
          resolve();
        });
      }),
      5_000,
      `Desuscripción MQTT (${topicList.join(", ")})`,
    );
  }

  async publish(topic: string, payload: Buffer | Uint8Array | string, agentId?: string): Promise<boolean> {
    try {
      const client = await this.connect(undefined, agentId);
      const buf = Buffer.from(payload);
      this.log("log", `\n>>> [MQTT:PUB]: ${topic} (${buf.length} bytes)`);

      return await this.withTimeout(
        new Promise<boolean>((ok) => {
          client.publish(topic, buf, { qos: 1 }, (err) => {
            if (err) {
              this.log("error", ">>> [MQTT:PUB_ERR]", err.message);
              ok(false);
            } else {
              this.log("log", ">>> [MQTT:PUB_OK] Publicación aceptada");
              ok(true);
            }
          });
        }),
        10_000,
        `Publicación MQTT (${topic})`,
      ).catch(() => false);
    } catch (e) {
      this.log("error", ">>> [MQTT:PUB_FATAL]", e);
      return false;
    }
  }

  private _handleIncomingMessage(topic: string, raw: Uint8Array | string) {
    const isServer = typeof window === "undefined";
    const payloadPreviewText = normalizePayloadText(raw);

    try {
      this.messageHandlers.forEach((h) => { try { h(topic, raw); } catch {} });

      if (topic.startsWith("pharmacy/")) {
        let decoded = false;
        const bufferPayload = payloadToUint8Array(raw);

        try {
          const order = OrderContactAndItems.decode(bufferPayload);
          const dataJson = JSON.stringify(OrderContactAndItems.toJSON(order), null, 2);
          const msg = `[MQTT:DECODE] OrderContactAndItems Ok! (Order: ${order.orderId})`;

          this.log("log", msg, OrderContactAndItems.toJSON(order));
          decoded = true;
        } catch (firstError) {
          this.log("warn", `[MQTT:DECODE] No se pudo decodificar como OrderContactAndItems:`, firstError);
          try {
            const order = OrderDto.decode(bufferPayload);
            this.log("log", `[MQTT:DECODE] OrderDto Ok! (Order: ${order.orderId})`, OrderDto.toJSON(order));
            decoded = true;
          } catch (secondError) {
            this.log("error", `[MQTT:DECODE] Fallo decodificación de payload de pharmacy/:`, secondError);
          }
        }

        this.log("log", `[MQTT:PAYLOAD_TEXT] ${payloadPreviewText}`);
      } else if (topic.includes("/error")) {
        this.log("log", `[MQTT:ERROR_MSG] ${payloadPreviewText}`);
      }

      const ulidRegex = /[0-9A-HJKMNP-TV-Z]{26}/i;
      let orderId = "";
      for (const part of topic.split("/")) {
        const match = part.match(ulidRegex);
        if (match) {
          orderId = match[0];
          break;
        }
      }

      if (orderId) {
        const current = this.store.get(orderId) ?? {};
        const suffix = topic.split("/").pop() || topic;
        current[suffix] = normalizePayloadText(raw);
        this.store.set(orderId, current);
        this.log("log", `[MQTT:STORE] Guardado para Order: ${orderId}`);
      }
    } catch (e) {
      this.log("error", ">>> [MQTT:ON_MESSAGE_FATAL]", e);
    }
  }

  getOrderData(orderId: string) {
    return this.store.get(orderId) ?? null;
  }

  resetAuthFailure() {
    this.authFailed = false;
    this.reconnectAttempts = 0;
    this.connecting = null;
    this.client = null;
    this.log("log", ">>> [MQTT:AUTH] Auth failure reset. Se puede reintentar.");
  }

  setRuntimeConfig(config: any) {
    this.runtimeConfig = config;
    this.log("log", ">>> [MQTT:CONFIG] Runtime config inyectada.");
  }

  disconnect() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      this.notifyDisconnected();
    }
    this.clearReconnectTimer();
  }
}

export const mqttServer = MqttServerService.get();
