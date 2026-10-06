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
  paidOrders: number;
  cancelledOrders: number;
  deliveryOrders: number;
  localOrders: number;
}

/**
 * Shape carrying the order status: the backend sends `saleStatus` (camelCase) but
 * legacy rows may still carry `sale_status`.
 *
 * `OrderListTable.statusKey` normalizes the exact same pair to render each row's
 * status chip. These two must stay in agreement: the stats cards and the table
 * describe the same orders, so a spelling the table renders but the stats ignore
 * would make the list and the counters disagree (an order could be shown as
 * "Completado" while landing in no bucket at all).
 */
type StatusCarrier = { saleStatus?: string | null; sale_status?: string | null };

const normalizeSaleStatus = (order: StatusCarrier | null | undefined): string =>
  String(order?.saleStatus ?? order?.sale_status ?? "").trim().toLowerCase();

/** The five status buckets the stats counters expose, plus `null` for anything unknown. */
type SaleStatusBucket = "completed" | "pending" | "paid" | "cancelled" | "failed";

/**
 * Maps an order's sale status onto the bucket its counter uses. This is the single
 * classification shared by the per-status counters and by `totalSales`, so a status
 * can never be revenue on one code path and a non-sale on another. `null` means the
 * status is absent or unrecognized: it is counted in no bucket and is NOT revenue.
 */
const classifySaleStatus = (order: StatusCarrier | null | undefined): SaleStatusBucket | null => {
  const status = normalizeSaleStatus(order);
  if (status === "completed" || status === "completada" || status === "entregada") return "completed";
  if (status === "pending" || status === "pendiente") return "pending";
  if (status === "paid") return "paid";
  if (status === "cancelled" || status === "cancelada" || status === "canceled") return "cancelled";
  if (status === "pipelinefailed") return "failed";
  return null;
};

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
   *
   * `totalSales` only counts orders whose status is a sale (Completed/Paid), reusing
   * the exact classification behind the counters; Cancelled, Pending, PipelineFailed
   * and unknown statuses contribute nothing. The amount per order is still
   * `calculateOrderTotal`; returns are not subtracted here because they are not
   * attributable per order in this payload.
   * @param orders Array of orders to analyze.
   * @returns An OrderStats object containing the calculated metrics.
   */
  static calculateStats(orders: Order[]): OrderStats {
    return orders.reduce(
      (stats, order) => {
        const total = this.calculateOrderTotal(order);

        stats.totalOrders += 1;

        // Normalize exactly like OrderListTable.statusKey, including the legacy
        // `sale_status` fallback, so the counters match the rows the operator sees.
        // Spellings accepted: completed / completada / entregada / pending / pendiente /
        // paid / cancelled / cancelada / canceled / pipelinefailed.
        //
        // The five backend statuses (Pending, Paid, Cancelled, Completed,
        // PipelineFailed) map one-to-one onto five row buckets so each card's count
        // equals what its matching list filter shows. `paid` deliberately does NOT
        // fold into `pendingOrders`: a paid order is money already collected with the
        // sale not yet finished, so it must stay individually visible -- that is the
        // state where losing sight of an order costs actual money.
        const status = classifySaleStatus(order);
        if (status === "completed") stats.completedOrders += 1;
        else if (status === "pending") stats.pendingOrders += 1;
        else if (status === "paid") stats.paidOrders += 1;
        else if (status === "cancelled") stats.cancelledOrders += 1;
        else if (status === "failed") stats.failedOrders += 1;

        // Only a completed or paid sale is revenue. The same classification that
        // decides the counter decides whether the amount counts, so a Cancelled,
        // Pending or PipelineFailed order can never inflate `totalSales`.
        if (status === "completed" || status === "paid") {
          stats.totalSales += total;
        }

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
        paidOrders: 0,
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
