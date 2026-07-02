import mqtt, { IClientOptions, IClientPublishOptions, MqttClient } from "mqtt";
import { DtoUpdateMedications } from "@/proto/interfaces/dto";
import { MqttConfig, MqttMessageHandler, MqttPayload, MqttConnectionChangeHandler } from "./types";
import { MQTT_TOPICS } from "./topics";

type QoSValue = 0 | 1 | 2;

export class MqttBrokerService {
  private client?: MqttClient;
  private connected = false;

  constructor(
    private config: MqttConfig,
    private messageHandler?: MqttMessageHandler,
    private connectionChangeHandler?: MqttConnectionChangeHandler,
  ) {}

  get isConnected(): boolean {
    return this.connected && !!this.client;
  }

  connect(): Promise<void> {
    if (this.client) {
      return Promise.resolve();
    }

    const url = `${this.config.protocol}://${this.config.brokerHost}:${this.config.brokerPort}`;

    const options: IClientOptions = {
      clientId: this.config.clientId,
      username: this.config.username,
      password: this.config.password,
      keepalive: this.config.keepalive ?? 20,
      reconnectPeriod: this.config.reconnectPeriod ?? 5000,
      clean: this.config.clean ?? false,
      connectTimeout: this.config.connectTimeoutMs ?? 30000,
      rejectUnauthorized: this.config.rejectUnauthorized ?? true,
    };

    // console.log("[MQTT] Attempting connection to:", url, "with clientId:", this.config.clientId);
    this.client = mqtt.connect(url, options);

    return new Promise((resolve, reject) => {
      this.client?.once("connect", () => {
        // console.log("[MQTT] Connected successfully to broker");
        this.connected = true;
        this.setupHandlers();
        resolve();
      });

      this.client?.once("error", (error) => {
        // console.error("[MQTT] Connection failed:", error);
        reject(error);
      });
    });
  }

  private setupHandlers() {
    if (!this.client) return;

    this.client.on("reconnect", () => {
      // console.debug("[MQTT] reconnecting");
    });

    this.client.on("close", () => {
      this.connected = false;
      // console.debug("[MQTT] disconnected");
      this.connectionChangeHandler?.(false);
    });

    this.client.on("connect", () => {
      this.connected = true;
      // console.debug("[MQTT] connected");
      this.connectionChangeHandler?.(true);
    });

    this.client.on("message", (topic, payload) => {
      // console.log(`[MQTT] Message received on topic: ${topic}`);
      const convertedPayload = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
      this.messageHandler?.(topic, convertedPayload);
    });
  }

  async subscribe(topic: string, qos: QoSValue = 1): Promise<void> {
    if (!this.client) {
      throw new Error("MQTT no conectado");
    }

    // console.log("[MQTT] Subscribing to topic:", topic);
    return new Promise((resolve, reject) => {
      this.client?.subscribe(topic, { qos }, (error) => {
        if (error) {
          // console.error("[MQTT] Subscription failed for topic:", topic, error);
          reject(error);
        } else {
          // console.log("[MQTT] Successfully subscribed to topic:", topic);
          resolve();
        }
      });
    });
  }

  async subscribeDefaultTopics(pharmacyId: string): Promise<void> {
    await Promise.all([
      this.subscribe(MQTT_TOPICS.inventoryInsert(pharmacyId)),
      this.subscribe(MQTT_TOPICS.inventoryUpdate(pharmacyId)),
      this.subscribe(MQTT_TOPICS.inventoryRemove(pharmacyId)),
      this.subscribe(MQTT_TOPICS.marketplacePharmacy(pharmacyId)),
    ]);
  }

  publishJson(topic: string, data: object, options: IClientPublishOptions = { qos: 1 }) {
    return this.publish(topic, JSON.stringify(data), options);
  }

  publishProto(topic: string, message: DtoUpdateMedications, options: IClientPublishOptions = { qos: 1 }) {
    return this.publish(topic, DtoUpdateMedications.encode(message).finish(), options);
  }

  publish(topic: string, payload: string | Uint8Array, options: IClientPublishOptions = { qos: 1 }): void {
    if (!this.client) {
      throw new Error("MQTT no conectado");
    }

    const message = typeof payload === "string" ? payload : (payload as any);
    // console.log("[MQTT] Publishing to topic:", topic, "payload:", message);
    this.client.publish(topic, message, options);
  }

  decodeDtoUpdateMedications(payload: Uint8Array): DtoUpdateMedications {
    return DtoUpdateMedications.decode(payload);
  }

  disconnect(): Promise<void> {
    if (!this.client) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.client?.end(false, {}, (error) => {
        if (error) {
          reject(error);
        } else {
          this.connected = false;
          resolve();
        }
      });
    });
  }
}

export function createMqttClientFromEnv(pharmacyId: string, handler?: MqttMessageHandler, connectionChangeHandler?: MqttConnectionChangeHandler) {
  const config: MqttConfig = {
    brokerHost: process.env.NEXT_PUBLIC_MQTT_BROKER_HOST ?? "",
    brokerPort: Number(process.env.NEXT_PUBLIC_MQTT_BROKER_PORT ?? 8883),
    protocol: (process.env.NEXT_PUBLIC_MQTT_PROTOCOL === "mqtt" ? "mqtt" : "mqtts") as MqttConfig["protocol"],
    username: process.env.NEXT_PUBLIC_MQTT_USERNAME ?? "",
    password: process.env.NEXT_PUBLIC_MQTT_PASSWORD ?? "",
    clientId: `${process.env.NEXT_PUBLIC_MQTT_CLIENT_ID_PREFIX ?? "medizin_terminal_"}${pharmacyId}`,
    keepalive: 20,
    reconnectPeriod: 5000,
    rejectUnauthorized: true,
    clean: false,
  };

  return new MqttBrokerService(config, handler, connectionChangeHandler);
}
