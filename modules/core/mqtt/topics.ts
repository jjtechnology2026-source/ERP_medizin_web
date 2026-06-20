export const MQTT_TOPICS = {
  salesWildcard: "farmacia/ventas/+",
  inventoryWildcard: "farmacia/inventario/+",
  stockAlerts: "farmacia/alertas/stock",
  inventoryInsert: (pharmacyId: string) => `pharmacy/${pharmacyId}/insert_inventory`,
  inventoryUpdate: (pharmacyId: string) => `pharmacy/${pharmacyId}/update_inventory`,
  inventoryRemove: (pharmacyId: string) => `pharmacy/${pharmacyId}/remove_inventory`,
  marketplacePharmacy: (pharmacyId: string) => `pharmacy/${pharmacyId}`,
  pendingOrdersWildcard: "farmacia/ordenes/pendientes/+",
  pendingOrdersConfirmationWildcard: "farmacia/ordenes/confirmacion/+",

  // Topics de venta individual por código de barra
  saleByBarCode: (barCode: string) => `farmacia/ventas/${barCode}`,

  // Topics de órdenes de venta
  orderSale: (orderId: string) => `farmacia/ordenes/${orderId}/venta`,

  // Topics de cliente para marketplace
  clientSearchMedicine: (clientId: string, orderId: string) =>
    `client/${clientId}/orden/${orderId}/search_medicine`,
  clientContactData: (clientId: string, orderId: string) =>
    `client/${clientId}/orden/${orderId}/data`,
  clientPharmacyChoice: (clientId: string, orderId: string) =>
    `client/${clientId}/orden/${orderId}/pharmacy_choice`,
  clientPaymentValidation: (clientId: string, orderId: string) =>
    `client/${clientId}/orden/${orderId}/payment`,

  // Topics de respuesta de farmacia
  acceptOrder: (pharmacyId: string, orderId: string) =>
    `pharmacy/${pharmacyId}/orden_id/${orderId}/accept_order`,
  rejectOrder: (pharmacyId: string, orderId: string) =>
    `pharmacy/${pharmacyId}/orden_id/${orderId}/negada_order`,
  paymentAccepted: (orderId: string) => `order_id/${orderId}/payment_accepted`,
  acceptedDelivery: (orderId: string) => `order_id/${orderId}/accepted_delivery`,
} as const;
