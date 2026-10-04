import api from "@/modules/core/api/client";
import { Order, ReprocessRefusalCode, ReprocessRefusalBody } from "../types/orders";

/** Operator-facing explanation per refusal code. Keep these actionable, not just descriptive. */
export const REPROCESS_REFUSAL_LABELS: Record<ReprocessRefusalCode, string> = {
  order_not_found:
    "La orden ya no existe en el servidor. Actualiza el listado antes de intentar de nuevo.",
  evidence_absent:
    "Esta orden es anterior al registro del fallo, así que no hay nada que reprocesar de forma segura. Verificar el stock manualmente.",
  partial_application:
    "La orden todavía tiene unidades aplicadas al inventario: compensar el stock antes de reintentar.",
  sale_movement_exists:
    "Ya existe un movimiento de Venta para esta orden, así que no se puede reprocesar. Revisar la venta ya registrada.",
  application_unverifiable:
    "Una fila de inventario cambió alrededor del fallo, por lo que no se puede verificar el descuento. Verificar el stock manualmente antes de reintentar.",
  application_proven_applied:
    "El inventario demuestra que el descuento de esta orden sí se aplicó: no reprocesar. Reconciliar la orden (marcarla como exitosa y registrar el movimiento faltante).",
  outcome_unknown:
    "Una sentencia de escritura devolvió error del driver, así que no se puede descartar que el stock se haya aplicado. Verificar el stock manualmente.",
};

const REPROCESS_REFUSAL_CODES: readonly ReprocessRefusalCode[] = [
  "order_not_found",
  "evidence_absent",
  "partial_application",
  "sale_movement_exists",
  "application_unverifiable",
  "application_proven_applied",
  "outcome_unknown",
];

function isReprocessRefusalCode(value: unknown): value is ReprocessRefusalCode {
  return typeof value === "string" && (REPROCESS_REFUSAL_CODES as readonly string[]).includes(value);
}

export interface OrderStats {
  totalSales: number;
  totalOrders: number;
  completedOrders: number;
  failedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  deliveryOrders: number;
  localOrders: number;
}

export class OrderService {
  /**
   * Calculates the correct total for an order by summing its medications.
   * Ensures that prices and quantities are treated as numbers even if they arrive as strings.
   * @param order The order object to calculate the total for.
   * @returns The total amount for the order.
   */
  static calculateOrderTotal(order: Order): number {
    if (!order.medications || order.medications.length === 0) {
      return order.totalreal || 0;
    }
    
    return order.medications.reduce((acc, med) => {
      const price = typeof med.price === 'number' ? med.price : parseFloat(med.price as any) || 0;
      const quantity = typeof med.quantity === 'number' ? med.quantity : parseFloat(med.quantity as any) || 0;
      return acc + (price * quantity);
    }, 0);
  }

  /**
   * Calculates global statistics for an array of orders.
   * This includes total sales volume and counts for different statuses and sale types.
   * @param orders Array of orders to analyze.
   * @returns An OrderStats object containing the calculated metrics.
   */
  static calculateStats(orders: Order[]): OrderStats {
    return orders.reduce(
      (stats, order) => {
        const total = this.calculateOrderTotal(order);
        
        stats.totalSales += total;
        stats.totalOrders += 1;

        if (order.saleStatus === "Completed") stats.completedOrders += 1;
        else if (order.saleStatus === "Pending") stats.pendingOrders += 1;
        else if (order.saleStatus === "Cancelled") stats.cancelledOrders += 1;
        else if (order.saleStatus === "PipelineFailed") stats.failedOrders += 1;

        const saleType = order.saleType?.toLowerCase();
        if (saleType === "delivery") stats.deliveryOrders += 1;
        else if (saleType === "local") stats.localOrders += 1;

        return stats;
      },
      {
        totalSales: 0,
        totalOrders: 0,
        completedOrders: 0,
        failedOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        deliveryOrders: 0,
        localOrders: 0,
      } as OrderStats
    );
  }

  /**
   * Formats a numeric value as a USD currency string.
   * Uses Intl.NumberFormat for proper localization and symbol placement.
   * @param amount The numeric amount to format.
   * @returns A string like "$1,234.56".
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  /**
   * Asks the backend to re-run ONE order's sale pipeline.
   *
   * A typed refusal (404/409 with a `refusal` code) is an expected answer, not an
   * error: the caller renders it. Only an unknown failure is a rejection.
   */
  static async reprocessOrder(orderId: string): Promise<
    | { ok: true }
    | { ok: false; code: ReprocessRefusalCode | "unknown"; message: string }
  > {
    try {
      const response = await api.post("/admin/Orders/reprocess", {
        order_id: orderId,
      });
      if (response.data?.accepted === true) {
        return { ok: true };
      }
      // A 200 without the documented acceptance flag is not an acceptance.
      return {
        ok: false,
        code: "unknown",
        message: "El servidor no confirmó el inicio del reproceso.",
      };
    } catch (error: unknown) {
      const body = (
        error as { response?: { data?: Partial<ReprocessRefusalBody> } } | undefined
      )?.response?.data;

      if (body && typeof body.refusal === "string") {
        // Never trust the code blindly: an unknown value is treated as unknown.
        const code = isReprocessRefusalCode(body.refusal) ? body.refusal : "unknown";
        const message =
          typeof body.error === "string" && body.error
            ? body.error
            : "El servidor rechazó el reproceso.";
        return { ok: false, code, message };
      }

      return {
        ok: false,
        code: "unknown",
        message: "No se pudo contactar al servidor. Verificar la conexión e intentar de nuevo.",
      };
    }
  }
}
