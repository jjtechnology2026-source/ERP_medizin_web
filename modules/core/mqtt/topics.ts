export const MQTT_TOPICS = {
  inventoryInsert: (pharmacyId: string) => `pharmacy/${pharmacyId}/insert_inventory`,
  inventoryUpdate: (pharmacyId: string) => `pharmacy/${pharmacyId}/update_inventory`,
  inventoryRemove: (pharmacyId: string) => `pharmacy/${pharmacyId}/remove_inventory`,
  marketplacePharmacy: (pharmacyId: string) => `pharmacy/${pharmacyId}`,

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
  completedOrder: (orderId: string) => `order/${orderId}/completed`,

  // Topics de mensajería farmacia ↔ cliente
  pharmacyToClient: (orderId: string) =>
    `order/${orderId}/pharmacy/message_client_send`,
  clientToPharmacy: (orderId: string) =>
    `order/${orderId}/cliente/message_pharmacy_send`,
} as const;
