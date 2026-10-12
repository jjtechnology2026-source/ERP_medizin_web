/*
  Tipos iniciales de referencia para la migracion a TypeScript.
  No son una implementacion completa; son contratos base derivados del cliente Flutter.
*/

export type ISODateString = string

export type SaleType = 'local' | 'delivery' | 'pickup'
export type SaleStatus = 'Pending' | 'Paid' | 'Completed' | 'Cancelled'

export interface Medicine {
  brand: string
  activeIngredient: string
  dosage: string
  tablets: string
  barCode: string
  name: string
  image: string
  category: string
  subcategory: string
  price: number
  quantity: number
  stock: number
  description: string
  controlled: boolean
  vat: number
  antibiotic: boolean
  minimum: number
}

export interface DatosFiscales {
  numeroInterno: string
  numeroControl: string
  trackingId: string
  urlPdf: string
  fecha: string
}

export interface FacturaResponse {
  success: boolean
  numeroControl?: string | null
  resp?: DatosFiscales | null
  error?: string | null
}

export interface PaymentCash {
  runtimeType: 'Cash'
  change: number
  amount: number
}

export interface PaymentDollars {
  runtimeType: 'Dollars'
  change: number
  amount: number
}

export interface PaymentCard {
  runtimeType: 'Card'
  punto: string
  type: string
  reference: string
  amount: number
}

export interface PaymentMobile {
  runtimeType: 'Mobile'
  amount: number
  reference: string
  bank: string
}

export interface PaymentBiopago {
  runtimeType: 'Biopago'
  amount: number
  reference: string
  bank: string
}

export type Payment =
  | PaymentCash
  | PaymentDollars
  | PaymentCard
  | PaymentMobile
  | PaymentBiopago

export interface Order {
  date: ISODateString
  idOrder: string
  nameGroup: string
  idAgent: string
  nameAgent: string
  idPharmacy: string
  idGroup: string
  medications: Medicine[]
  totalreal: number
  totalsystem: number
  clientName: string
  clientLastName: string
  clientId: string
  clientEmail: string
  clientPhone: string
  payments: Payment[]
  rate: number
  rifEmisor?: string | null
  gender: string
  saleStatus: SaleStatus
  isControlled: boolean
  saleType: SaleType
  address: string
  pharmacy: string
  synced: boolean
  numeroControlInterno?: string | null
  facturacion?: FacturaResponse | null
  observation?: string | null
}

export interface UserModel {
  id: string
  name: string
  email: string
  direccion: string
  documento: string
  phone: string
}

export interface CachedUser extends UserModel {
  synced: boolean
  timestamp: ISODateString
  syncedAt?: ISODateString
}

export interface FiscalConfiguration {
  implementation: 'pnp' | 'thefactoryhka' | 'posvenezuela' | string
  port: string
}

export interface FiscalZReportEntry {
  implementation: string
  zNumber: string
  lastInvoiceNumber: string
  serial: string
  machineDate: string
  machineTime: string
  companyName: string
  branchName: string
  totalAmount: string
  alertMessage: string
  payloadJson: string
  generatedAt: string
}

export interface FiscalTestLogEntry {
  implementation: string
  action: string
  success: boolean
  message: string
  source: string
  createdAt: string
}

export interface JsonData {
  token: string
  refresh_Token: string
  groupId: string
  groupName: string
  email: string
  sanitaryRegistrationNumber: string
  mppRegistration: string
  birthDate: string
  phoneNumber: string
  agentId: string
  agentUsername: string
  usesDigitalBilling: boolean
  agentPassword: string
  pharmacyName: string
  pharmacyId: string
  role: string
  permits: string[]
  orderMarketplace: Order[]
  medicines: Medicine[]
  orders: Order[]
  pendingOrders: Order[]
  pendingMedicationsSync: Medicine[]
  fiscalZReports: FiscalZReportEntry[]
  fiscalTestLogs: FiscalTestLogEntry[]
  rifPharmacy: string
  rate: number
}

export interface AgentLogin {
  user: string
  password: string
  lastLogin?: ISODateString
}

export interface AgentLoginResponse {
  success: boolean
  token?: string | null
  refreshToken?: string | null
  message?: string | null
  agentData?: Record<string, unknown> | null
}

export interface AuditCreateRequest {
  action: string
  entityName: string
  entityId: string
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  actorName?: string | null
  userAgent?: string | null
}

export interface AuditLogFilters {
  entityName?: string
  entityId?: string
  userId?: string
  action?: string
  startDate?: ISODateString
  endDate?: ISODateString
  limit: number
  offset: number
}

export interface AuditLogEntry {
  id: string
  action: string
  entityName: string
  entityId: string
  userId: string
  timestamp: ISODateString
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  ipAddress?: string | null
  actorName?: string | null
  userAgent?: string | null
}

export interface AuditLogPage {
  items: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

export interface DigitalBillingCustomerData {
  rif: string
  razonSocial: string
  direccion: string
  telefono: string
  correo: string
}

export interface DigitalBillingAffectedDocument {
  numeroDocumento: string
  fechaEmision: string
  montoTotal: number
  motivo: string
}

export interface DigitalBillingItem {
  descripcion: string
  codigoPlu: string
  cantidad: number
  precioUnitario: number
  vat: number
  esExento: boolean
}

export interface DigitalBillingNoteRequest {
  idPharmacy: string
  entidad: string
  tasaCambio: number
  rifEmisor: string
  trackingId: string
  numeroControlInterno: string
  cliente: DigitalBillingCustomerData
  documentoAfectado: DigitalBillingAffectedDocument
  items: DigitalBillingItem[]
}

export interface DigitalBillingNoteResult {
  success: boolean
  statusCode: number
  message: string
  details?: string
  response?: FacturaResponse | null
  updatedOrder?: Order | null
  showAlertDialog?: boolean
  alertDialogType?: string
}

export interface DigitalBillingZReportAmount {
  ves: number
  usd: number
}

export interface DigitalBillingZReportCashRegister {
  id?: string | null
  codigo: string
  nombre: string
  montoBaseVes: number
  montoBaseUsd: number
  ubicacion?: string | null
  estado: string
  createdAt: string
}

export interface DigitalBillingZReportSession {
  id?: string | null
  cajaId: string
  usuarioAperturaId: string
  usuarioCierreId?: string | null
  fechaApertura: string
  fechaCierre?: string | null
  montoAperturaVes: number
  montoAperturaUsd: number
  montoCierreFisicoVes: number
  montoCierreFisicoUsd: number
  totalVentasVes: number
  totalVentasUsd: number
  totalGastosVes: number
  totalGastosUsd: number
  diferenciaVes: number
  diferenciaUsd: number
}

export interface DigitalBillingZReportData {
  fechaReporte: string
  sucursal: string
  fecha: string
  cantidadTurnos: number
  detalleSesiones: DigitalBillingZReportSession[]
  caja?: DigitalBillingZReportCashRegister | null
  fondoInicial?: DigitalBillingZReportAmount | null
  fondoFinal?: DigitalBillingZReportAmount | null
  totalVentas?: DigitalBillingZReportAmount | null
  totalGastos?: DigitalBillingZReportAmount | null
  totalRetirado?: DigitalBillingZReportAmount | null
  diferenciaAcumulada?: DigitalBillingZReportAmount | null
  empresa?: Record<string, unknown> | null
  controlConsecutivos?: Record<string, unknown> | null
  reporteZ?: Record<string, unknown> | null
  anulacionesOtrosDias?: Record<string, unknown> | null
}

export interface DigitalBillingZReportResponse {
  data?: DigitalBillingZReportData | null
}

export interface InventorySalePayload {
  ventaId: string
  orderId: string
  medicamento: string
  barCode: string
  cantidad: number
  precio: number
  total: number
  timestamp: ISODateString
  cajero: string
  clientId: string
}

export interface InventoryOrderSalePayload {
  orderId: string
  clientName: string
  clientId: string
  totalSystem: number
  totalReal: number
  medications: Array<{
    barCode: string
    name: string
    quantity: number
    price: number
    total: number
  }>
  timestamp: ISODateString
  saleType: string
  clientIdMqtt: string
}

export interface InventoryUpdatePayload {
  medicamento: string
  barCode: string
  stockAnterior: number
  stockNuevo: number
  diferencia: number
  razon: string
  timestamp: ISODateString
  clientId: string
}

export interface StockAlertPayload {
  medicamento: string
  barCode: string
  stockActual: number
  stockMinimo: number
  nivel: 'AGOTADO' | 'BAJO' | string
  timestamp: ISODateString
  clientId: string
}

export interface ProtoMedication {
  brand: string
  activeIngredient: string
  dosage: string
  tablets: string
  barCode: string
  name: string
  image: string
  category: string
  subcategory: string
  price: number
  quantity: number
  stock: number
  description: string
  controlled: boolean
  vat: number
  antibiotic: boolean
  minimum: number
}

export interface ProtoDtoUpdateMedications {
  idAgent: string
  idPharmacy: string
  medications: ProtoMedication[]
}

export interface ClientGeoJSONPoint {
  latitude: number
  longitude: number
}

export interface ClientMedicineDto {
  name: string
  image: string
  medicineId: string
  quantity: number
}

export interface ClientOrderDto {
  orderId: string
  medicines: ClientMedicineDto[]
  geolocation: ClientGeoJSONPoint
}

export interface ClientContactLocation {
  name: string
  cedula: string
  address: string
  phone: string
  latitude: number
  longitude: number
}

export interface ClientOrderItem {
  barcode: string
  quantity: number
}

export interface ClientOrderContactAndItems {
  orderId: string
  pharmacyId: string
  clientName: string
  clientAddress: string
  clientIdNumber: string
  clientPhone: string
  clienteEmail?: string
  items: ClientOrderItem[]
}

export interface AcceptOrderMessage {
  pharmacyId: string
  orderId: string
}

export interface RejectedOrderMessage {
  pharmacyId: string
  orderId: string
  reason?: string
}

export interface OrderProtoPending {
  date: ISODateString
  idOrder: string
  nameGroup: string
  idAgent: string
  nameAgent: string
  idPharmacy: string
  idGroup: string
  medications: ProtoMedication[]
  totalreal: number
  totalsystem: number
  clientName: string
  clientLastName: string
  clientId: string
  payments: Payment[]
  rate: number
  gender: string
  saleStatus: Exclude<SaleStatus, 'Paid'>
  isControlled: boolean
  saleType: SaleType
  address: string
  pharmacy: string
}

export const LOCAL_STORAGE_FILES = {
  inventoryData: 'C:/inventario_medizin/inventario.json',
  medicinesData: 'C:/inventario_medizin/medicamentos.json',
  authCache: 'C:/inventario_medizin/auth_cache.json',
  authResponseCache: 'C:/inventario_medizin/auth_response_cache.json',
  userCache: 'C:/inventario_medizin/users_cache.json',
  fiscalConfig: 'C:/inventario_medizin/fiscal_config.json',
} as const

export const MQTT_TOPICS = {
  salesWildcard: 'farmacia/ventas/+',
  inventoryWildcard: 'farmacia/inventario/+',
  stockAlerts: 'farmacia/alertas/stock',
  inventoryInsert: (pharmacyId: string) => `pharmacy/${pharmacyId}/insert_inventory`,
  inventoryUpdate: (pharmacyId: string) => `pharmacy/${pharmacyId}/update_inventory`,
  inventoryDecrease: (pharmacyId: string) => `pharmacy/${pharmacyId}/decrease_inventory`,
  marketplacePharmacy: (pharmacyId: string) => `pharmacy/${pharmacyId}`,
  pendingOrdersWildcard: 'farmacia/ordenes/pendientes/+',
  pendingOrdersConfirmationWildcard: 'farmacia/ordenes/confirmacion/+',
  clientSearchMedicine: (clientId: string, orderId: string) => `client/${clientId}/orden/${orderId}/search_medicine`,
  clientContactData: (clientId: string, orderId: string) => `client/${clientId}/orden/${orderId}/data`,
  clientPharmacyChoice: (clientId: string, orderId: string) => `client/${clientId}/orden/${orderId}/pharmacy_choice`,
  clientPaymentValidation: (clientId: string, orderId: string) => `client/${clientId}/orden/${orderId}/payment`,
  acceptOrder: (pharmacyId: string, orderId: string) => `pharmacy/${pharmacyId}/orden_id/${orderId}/accept_order`,
  rejectOrder: (pharmacyId: string, orderId: string) => `pharmacy/${pharmacyId}/orden_id/${orderId}/negada_order`,
  paymentAccepted: (orderId: string) => `order_id/${orderId}/payment_accepted`,
} as const