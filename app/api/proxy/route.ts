import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import axios from "axios";
import https from "node:https";

// Reusa conexiones TLS contra el API: evita handshake por request.
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64 });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { url, method = "GET", data, params, headers = {} } = body;

    if (!process.env.NEXT_PUBLIC_API_URL) {
      console.error("❌ NEXT_PUBLIC_API_URL no está definida");
      return NextResponse.json(
        { success: false, message: "API_URL no configurada" },
        { status: 500 }
      );
    }

    const effectiveMethod = method;

    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    const finalHeaders: any = {
      "Content-Type": "application/json",
      ...headers,
    };

    // Prefer JWT session token; fall back to Authorization forwarded by the client interceptor
    const bearerFromSession = token?.accessToken
      ? `Bearer ${token.accessToken}`
      : null;
    const bearerFromRequest =
      req.headers.get("authorization") ||
      (typeof headers.Authorization === "string" ? headers.Authorization : null) ||
      (typeof headers.authorization === "string" ? headers.authorization : null);

    if (bearerFromSession) {
      finalHeaders["Authorization"] = bearerFromSession;
    } else if (bearerFromRequest) {
      finalHeaders["Authorization"] = bearerFromRequest;
    }

    const targetUrl = `${process.env.NEXT_PUBLIC_API_URL}${url}`;

    const config: any = {
      url: targetUrl,
      method: effectiveMethod,
      headers: finalHeaders,
      validateStatus: () => true,
      timeout: 30000,
      httpsAgent,
    };

    // Si es GET, permitimos pasar data como body (la API lo espera)
    if (effectiveMethod.toUpperCase() === "GET") {
      config.params = params;   // query params normales
      config.data = data;       // body para GET (no estándar, pero necesario)
    } else {
      config.data = data;
      config.params = params;
    }

    const response = await axios(config);
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error("❌ [Proxy] Error:", error.message);
    if (error.response) {
      console.error("📩 Respuesta de error:", error.response.status, error.response.data);
    }
    const isTimeout = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
    return NextResponse.json(
      {
        success: false,
        message: isTimeout
          ? "Tiempo de espera agotado al contactar el API"
          : error.message || "Error en el proxy",
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}