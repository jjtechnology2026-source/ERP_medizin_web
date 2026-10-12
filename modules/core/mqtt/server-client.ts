import mqtt from "mqtt";

const brokerUrl = "wss://mqtt-broker-production-7352.up.railway.app:443/mqtt";
const baseOptions = {
  username: "medizin",
  password: "Medizin12",
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
};

let client: mqtt.MqttClient | null = null;

export function getMqttClient(): mqtt.MqttClient | null {
  return client;
}

export function connectMqtt(pharmacyId: string) {
  if (client) {
    client.end(true);
  }

  client = mqtt.connect(brokerUrl, {
    ...baseOptions,
    clientId: `medizin_terminal_${pharmacyId}`,
  });

  client.on("connect", () => {
    console.log("✅ [MQTT] Conectado al broker");
    client?.subscribe([
      `pharmacy/${pharmacyId}/insert_inventory`,
      `pharmacy/${pharmacyId}/update_inventory`,
      `pharmacy/${pharmacyId}/decrease_inventory`,
    ], { qos: 1 });
  });

  client.on("error", (err) => {
    console.error("❌ [MQTT] Error:", err);
  });

  return client;
}