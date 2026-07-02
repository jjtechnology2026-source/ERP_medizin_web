import mqtt from "mqtt";

const brokerUrl = "mqtts://v1106ae1.ala.us-east-1.emqxsl.com:8883";
const baseOptions = {
  username: "inventario_medizin",
  password: "prueba1234",
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
      `pharmacy/${pharmacyId}/remove_inventory`,
    ], { qos: 1 });
  });

  client.on("error", (err) => {
    console.error("❌ [MQTT] Error:", err);
  });

  return client;
}