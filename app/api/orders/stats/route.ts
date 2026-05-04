import { NextRequest, NextResponse } from "next/server";
import { OrderService } from "@/modules/orders/services/OrderService";
import { Order } from "@/modules/orders/types/orders";

export async function POST(req: NextRequest) {
  try {
    const { orders } = await req.json();
    
    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: "Invalid orders data" }, { status: 400 });
    }

    const stats = OrderService.calculateStats(orders);
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error calculating stats:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
