import { Order } from "../types/orders";

export interface OrderStats {
  totalSales: number;
  totalOrders: number;
  completedOrders: number;
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

        const saleType = order.saleType?.toLowerCase();
        if (saleType === "delivery") stats.deliveryOrders += 1;
        else if (saleType === "local") stats.localOrders += 1;

        return stats;
      },
      {
        totalSales: 0,
        totalOrders: 0,
        completedOrders: 0,
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
}
