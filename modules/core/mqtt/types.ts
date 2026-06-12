export type MqttProtocol = "mqtt" | "mqtts";

export interface MqttConfig {
  brokerHost: string;
  brokerPort: number;
  protocol: MqttProtocol;
  username: string;
  password: string;
  clientId: string;
  keepalive?: number;
  reconnectPeriod?: number;
  rejectUnauthorized?: boolean;
  clean?: boolean;
  connectTimeoutMs?: number;
}

export type MqttPayload = Uint8Array | string;

export type MqttMessageHandler = (topic: string, payload: MqttPayload) => void;
export type MqttConnectionChangeHandler = (connected: boolean) => void;
