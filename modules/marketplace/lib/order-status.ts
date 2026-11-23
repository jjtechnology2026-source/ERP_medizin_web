import type { Order } from "../../orders/types/orders";

/**
 * A marketplace order counts as completed for either status vocabulary the
 * backend sends (`saleStatus` in the camelCase payload, `sale_status` in the
 * raw row, where it also arrives as Spanish "COMPLETADA").
 */
export function isCompletedOrder(order: Order): boolean {
  return (
    order.saleStatus === "Completed" ||
    (order as any).sale_status === "Completed" ||
    (order as any).sale_status === "COMPLETADA"
  );
}

export function orderStatusLabel(order: Order): string {
  return isCompletedOrder(order) ? "Completado" : "Pendiente";
}
