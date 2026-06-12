import { NextRequest, NextResponse } from "next/server";
import { getMqttClient } from "@/modules/core/mqtt/server-client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { topic, payload } = body;

  const client = getMqttClient();
  if (!client) {
    return NextResponse.json({ success: false, message: "MQTT no conectado" }, { status: 503 });
  }

  return new Promise((resolve) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error("❌ [MQTT] Error publicando:", err);
        resolve(NextResponse.json({ success: false, message: err.message }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ success: true }));
      }
    });
  });
}