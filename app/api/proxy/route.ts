import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("📥 [Proxy] Body recibido:", body);

    const { url, method = "GET", data, params, headers = {} } = body;

    if (!process.env.NEXT_PUBLIC_API_URL) {
      console.error("❌ NEXT_PUBLIC_API_URL no está definida");
      return NextResponse.json(
        { success: false, message: "API_URL no configurada" },
        { status: 500 }
      );
    }

    let effectiveMethod = method;

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
      console.log("🔐 Token agregado desde sesión JWT");
    } else if (bearerFromRequest) {
      finalHeaders["Authorization"] = bearerFromRequest;
      console.log("🔐 Token agregado desde header del cliente");
    } else {
      console.log("⚠️ No se encontró accessToken en la sesión ni Authorization en el request");
    }

    const targetUrl = `${process.env.NEXT_PUBLIC_API_URL}${url}`;
    console.log(`🚀 [Proxy] ${effectiveMethod} ${targetUrl}`);

    const config: any = {
      url: targetUrl,
      method: effectiveMethod,
      headers: finalHeaders,
      validateStatus: () => true,
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
    console.log(`📩 [Proxy] Respuesta: ${response.status}`, response.data);
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error("❌ [Proxy] Error:", error.message);
    if (error.response) {
      console.error("📩 Respuesta de error:", error.response.status, error.response.data);
    }
    return NextResponse.json(
      { success: false, message: error.message || "Error en el proxy" },
      { status: 500 }
    );
  }
}