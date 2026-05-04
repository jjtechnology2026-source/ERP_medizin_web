import mqtt, { MqttClient, IClientOptions } from "mqtt";
import { OrderDto } from "@/proto/interfaces/present";
import { OrderContactAndItems } from "@/proto/interfaces/dto";
import { MQTT_TOPICS } from "./topics";
import { logToServer } from "./server-logger.actions";

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
  private authFailed = false; // Si las credenciales son incorrectas, paramos todo.
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  // Tópicos activos para re-suscripción automática en caso de caída
  private activeSubscriptions = new Set<string>();
  private runtimeConfig: any = null;

  // Callbacks para notificar cambios de conexión
  private connectionChangeHandler?: (connected: boolean) => void;
  private messageHandler?: (topic: string, payload: Uint8Array | string) => void;

  static get(): MqttServerService {
    if (!g._mqttSrv_v1) {
      g._mqttSrv_v1 = new MqttServerService();
    }
    return g._mqttSrv_v1;
  }

  setHandlers(connectionChangeHandler?: (connected: boolean) => void, messageHandler?: (topic: string, payload: Uint8Array | string) => void) {
    this.connectionChangeHandler = connectionChangeHandler;
    this.messageHandler = messageHandler;
  }

  private log(level: "log" | "warn" | "error", msg: string, ...args: any[]) {
    const isServer = typeof window === "undefined";
    if (isServer) {
      console[level](msg, ...args);
    } else {
      // Redirect important logs to server, suppress local console
      if (msg.includes("[MQTT:CONNECT]") || msg.includes("[MQTT:SUB]") || msg.includes("[MQTT:DECODE]") || msg.includes("[MQTT:PUB]")) {
        logToServer(level, msg, args.length > 0 ? args : undefined);
      }
    }
  }

  /** Limpiar reconexión pendiente */
  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Programar re-conexión manual con backoff exponencial (máx 30s) */
  private scheduleReconnect() {
    if (this.authFailed) {
      return;
    }
    this.clearReconnectTimer();
    const delay = Math.min(3_000 * Math.pow(1.5, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connecting = null;
      this.client = null;
      this.connect().catch((e) => this.log("error", e.message));
    }, delay);
  }

  /** Helper para timeouts en promesas */
  private async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout: ${label} tras ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]);
  }

  private connect(): Promise<MqttClient> {
    if (this.authFailed) {
      return Promise.reject(new Error("MQTT: Autenticación fallida — revisa las credenciales."));
    }
    if (this.client?.connected) return Promise.resolve(this.client);
    if (this.connecting) return this.connecting;

    // Detectar el entorno
    const isServer = typeof window === "undefined";

    const host = this.runtimeConfig?.EMQX_BROKER || process.env.NEXT_PUBLIC_MQTT_BROKER_HOST;
    const wssUrl = this.runtimeConfig?.MQTT_URL || process.env.NEXT_PUBLIC_MQTT_URL;
    const port = this.runtimeConfig?.EMQX_PORT || process.env.NEXT_PUBLIC_MQTT_BROKER_PORT;
    const username = this.runtimeConfig?.EMQX_USER || process.env.NEXT_PUBLIC_MQTT_USERNAME;
    const password = this.runtimeConfig?.EMQX_PASS || process.env.NEXT_PUBLIC_MQTT_PASSWORD;

    const finalUrl = isServer ? `mqtt://${host}:${port}` : wssUrl || `wss://${host}:${port}/mqtt`;

    if (!finalUrl || finalUrl.includes("undefined") || finalUrl === "mqtt://undefined:undefined") {
      this.log("error", "[MQTT] Error: URL de conexión inválida o no configurada.");
      return Promise.reject(new Error("MQTT config missing (URL/Host/Port)"));
    }

    this.log("log", `\n>>> [MQTT:CONNECT] Conectando (${isServer ? "SERVER" : "CLIENT"}): ${finalUrl}`);

    const connectPromise = new Promise<MqttClient>((resolve, reject) => {
      const opts: IClientOptions = {
        protocolVersion: 5,
        clientId: `medizin_terminal_${this.runtimeConfig?.pharmacyId || "unknown"}`,
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
        this.clearReconnectTimer();
        this.log("log", ">>> [MQTT:CONNECT] Servidor Conectado y Autenticado");
        this.connectionChangeHandler?.(true);

        if (this.activeSubscriptions.size > 0) {
          const topics = Array.from(this.activeSubscriptions);
          if (isServer) {
            this.log("log", `>>> [MQTT:RESTORE] Re-suscribiendo a ${topics.length} tópicos...`);
          }
          c.subscribe(topics, { qos: 1 });
        }
        resolve(c);
      });

      c.on("message", this.onMessage.bind(this));

      c.on("error", (err) => {
        this.log("error", ">>> [MQTT:ERROR] ", err.message);

        const msg = err.message.toLowerCase();
        if (
          msg.includes("bad user name") ||
          msg.includes("not authorized") ||
          msg.includes("connection refused: 4") ||
          msg.includes("connection refused: 5")
        ) {
            this.log("error", ">>> [MQTT:AUTH] Error de credenciales. Se detiene la reconexión automática.");
          this.authFailed = true;
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
        this.connectionChangeHandler?.(false);
        if (!settled) {
          settled = true;
          this.connecting = null;
          reject(new Error("Connection closed before established"));
        }
        this.scheduleReconnect();
      });

      c.on("packetreceive", (p) => {
          this.log("log", `[MQTT:RAW] ← INBOUND on ${(p as any).topic}`);
      });
    });

    this.connecting = this.withTimeout(connectPromise, 20_000, "Conexión MQTT");
    return this.connecting;
  }

  async subscribeToMarketplace(pharmacyId: string): Promise<void> {
    const topics = [MQTT_TOPICS.marketplacePharmacy(pharmacyId), MQTT_TOPICS.pendingOrdersWildcard, MQTT_TOPICS.pendingOrdersConfirmationWildcard];

    const client = await this.connect();

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

  async publish(topic: string, payload: Buffer | Uint8Array | string): Promise<boolean> {
    try {
      const client = await this.connect();
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

  private onMessage(topic: string, raw: Uint8Array | string) {
    const isServer = typeof window === "undefined";
    const payloadPreviewText = normalizePayloadText(raw);

    try {
      this.messageHandler?.(topic, raw);

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
      this.connectionChangeHandler?.(false);
    }
    this.clearReconnectTimer();
  }
}

export const mqttServer = MqttServerService.get();
