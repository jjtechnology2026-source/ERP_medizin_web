import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import axios from "axios";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
type Method = (typeof METHODS)[number];

async function proxy(req: NextRequest, method: Method) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      return NextResponse.json(
        { success: false, message: "API_URL no configurada" },
        { status: 500 },
      );
    }

    const { pathname, search } = req.nextUrl;
    const targetPath = pathname.replace(/^\/api\/proxy\//, "/");
    const targetUrl = `${apiUrl}${targetPath}${search}`;

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token?.accessToken) {
      headers["Authorization"] = `Bearer ${token.accessToken}`;
    }

    let body: any = undefined;
    if (method !== "GET") {
      try { body = await req.clone().json(); } catch {}
    }

    const response = await axios({
      method,
      url: targetUrl,
      headers,
      data: body,
      validateStatus: () => true,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error(`[Proxy/${method}]`, error.message);
    return NextResponse.json(
      { success: false, message: error.message || "Error en proxy" },
      { status: 500 },
    );
  }
}

export const GET = (req: NextRequest) => proxy(req, "GET");
export const POST = (req: NextRequest) => proxy(req, "POST");
export const PUT = (req: NextRequest) => proxy(req, "PUT");
export const DELETE = (req: NextRequest) => proxy(req, "DELETE");
export const PATCH = (req: NextRequest) => proxy(req, "PATCH");
