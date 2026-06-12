import { NextRequest } from "next/server";
import { getMqttClient } from "@/modules/core/mqtt/server-client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const client = getMqttClient();
  if (!client) {
    return new Response("MQTT no conectado", { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const onMessage = (topic: string, message: Buffer) => {
        const data = `data: ${JSON.stringify({ topic, payload: message.toString() })}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      client.on("message", onMessage);

      req.signal.addEventListener("abort", () => {
        client.removeListener("message", onMessage);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}