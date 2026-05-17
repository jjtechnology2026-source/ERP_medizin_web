import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, method = "GET", data, params, headers = {} } = body;

    const targetUrl = `${process.env.NEXT_PUBLIC_API_URL}${url}`;

    // Realizar la petición desde el servidor Node.js
    const response = await axios({
      url: targetUrl,
      method,
      data,
      params,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      validateStatus: () => true,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Error en el servidor proxy" },
      { status: 500 }
    );
  }
}
