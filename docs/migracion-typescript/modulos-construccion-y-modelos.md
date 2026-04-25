# Modulos del Proyecto, Construccion desde Cero y Modelos de Datos

## Objetivo

Este documento sirve como mapa de reimplementacion. Resume los modulos del proyecto, las tareas necesarias para reconstruirlo desde cero en TypeScript y los modelos de datos locales que realmente utiliza la app. Tambien aclara que la app no usa una base de datos embebida tradicional, sino persistencia en archivos JSON y secure storage.

## Arquitectura General Observada

El proyecto es una aplicacion Flutter de escritorio con estas capacidades principales:

- autenticacion de agentes
- inventario local y remoto
- caja y ventas
- ordenes internas y marketplace
- reportes
- facturacion fiscal local y digital
- auditoria
- sincronizacion online y offline
- actualizaciones por MQTT en tiempo real

La organizacion del codigo es feature-first con modulos funcionales dentro de lib/.

## Modulos del Proyecto

### auth

Responsabilidad:

- Login de agente.
- Carga de sesion.
- cache de credenciales y respuesta de login.
- inicializacion de Dio y tokens.

Piezas clave:

- modelos de agente
- provider de autenticacion
- repositorio de autenticacion
- cliente HTTP con refresh token

### audit

Responsabilidad:

- Registro y consulta de auditoria.
- logging seguro de operaciones manuales y automaticas.

### cash_register

Responsabilidad:

- Flujo de caja.
- composicion de ordenes.
- seleccion de pagos.
- publicacion de salidas de inventario por MQTT.

### controlled_medications

Responsabilidad:

- Vistas y reglas para medicamentos controlados.

### create_product

Responsabilidad:

- Alta de productos.
- importacion masiva.
- carga de imagenes.
- armado de formularios de producto.

### marketplace_orders

Responsabilidad:

- Recepcion de ordenes por MQTT.
- aceptacion o rechazo.
- transicion a pago aceptado y descuento de inventario.

### orders

Responsabilidad:

- Persistencia y consulta de ordenes.
- sincronizacion de ordenes locales.
- emision de notas de credito o debito digitales.
- integracion con fiscalizacion local y digital.

### reports

Responsabilidad:

- Reportes de ventas.
- resumenes de cierre.
- notas de facturacion digital.

### stats

Responsabilidad:

- indicadores y estadisticas.
- graficas por categorias, ventas y productos.

### stock

Responsabilidad:

- vistas de inventario.
- stock minimo.
- busqueda y mantenimiento.

### system_configuration

Responsabilidad:

- configuracion fiscal local.
- pruebas y diagnostico fiscal.
- historial de reportes Z.

### maquina_fiscal

Responsabilidad:

- integracion con proveedores fiscales locales.

Implementaciones detectadas:

- pnp
- thefactoryhka
- posvenezuela

Notas:

- POS Venezuela tiene flujo local de nota de credito.
- PNP y The Factory no exponen nota de credito o debito local en esta integracion.

### shape

Responsabilidad:

- nucleo transversal del proyecto.
- modelos compartidos.
- servicios HTTP generales.
- datasource local JSON.
- componentes comunes.
- MQTT.
- providers base.

### shared

Responsabilidad:

- infraestructura local comun.
- rutas de archivos.
- almacenamiento JSON.
- componentes reutilizables.

### User_Panel

Responsabilidad:

- panel agregado de usuario con metricas y vistas resumen.

### config

Responsabilidad:

- router
- theme
- configuracion MQTT
- secretos y base URLs
- service locator

## Modelos de Datos y Persistencia Local Usada por la App

## Aclaracion importante

La app no usa SQLite, Drift, Hive ni ObjectBox como base de datos local primaria. Lo que realmente utiliza es:

- archivos JSON en disco
- base64 sobre varios JSON locales
- flutter_secure_storage para tokens

En consecuencia, para migracion a TypeScript conviene pensar en:

- almacenamiento de archivos JSON locales si sera desktop puro
- o una capa equivalente de storage si sera Electron, Node o web

## Rutas locales observadas

Raiz de persistencia:

- C:/inventario_medizin

Archivos usados:

- inventario.json
- medicamentos.json
- auth_cache.json
- auth_response_cache.json
- users_cache.json
- fiscal_config.json

## Modelo raiz: JsonData

JsonData es el contenedor principal de estado persistido.

Campos persistidos:

```ts
type JsonData = {
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
```

Uso:

- Es el pseudo estado global persistido del cliente.
- Mezcla sesion, catalogo, ordenes, cola de sincronizacion y trazas fiscales.

## Modelo Medicine

```ts
type Medicine = {
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
```

Uso:

- catalogo de medicamentos
- inventario local
- payload HTTP y protobuf
- detalle de orden

## Modelo Order

```ts
type SaleType = 'local' | 'delivery' | 'pickup'
type SaleStatus = 'Pending' | 'Paid' | 'Completed' | 'Cancelled'

type Order = {
  date: string
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
  rifEmisor?: string
  gender: string
  saleStatus: SaleStatus
  isControlled: boolean
  saleType: SaleType
  address: string
  pharmacy: string
  synced: boolean
  numeroControlInterno?: string
  facturacion?: FacturaResponse
  observation?: string
}
```

Uso:

- ventas locales
- ordenes marketplace
- pendientes de sincronizacion
- trazabilidad fiscal

## Modelo Payment

Es una union discriminada.

```ts
type Payment =
  | { runtimeType: 'Cash'; change: number; amount: number }
  | { runtimeType: 'Dollars'; change: number; amount: number }
  | { runtimeType: 'Card'; punto: string; type: string; reference: string; amount: number }
  | { runtimeType: 'Mobile'; amount: number; reference: string; bank: string }
  | { runtimeType: 'Biopago'; amount: number; reference: string; bank: string }
```

Uso:

- serializacion local
- envio de ordenes al backend
- serializacion protobuf de ordenes pendientes

## Modelo FacturaResponse y DatosFiscales

```ts
type DatosFiscales = {
  numeroInterno: string
  numeroControl: string
  trackingId: string
  urlPdf: string
  fecha: string
}

type FacturaResponse = {
  success: boolean
  numeroControl?: string
  resp?: DatosFiscales
  error?: string
}
```

Uso:

- respuesta de facturacion digital
- embebida dentro de Order

## Modelo UserModel

```ts
type UserModel = {
  id: string
  name: string
  email: string
  direccion: string
  documento: string
  phone: string
}
```

Persistencia asociada:

- users_cache.json

Formato cacheado:

```ts
type CachedUser = UserModel & {
  synced: boolean
  timestamp: string
  syncedAt?: string
}
```

Uso:

- fallback offline de busqueda de usuarios
- cola de sincronizacion de usuarios creados sin red

## Modelo de cache de autenticacion

Archivo:

- auth_cache.json

Modelo:

```ts
type AgentLogin = {
  user: string
  password: string
  lastLogin?: string
}
```

Archivo:

- auth_response_cache.json

Modelo:

```ts
type AgentLoginResponse = {
  success: boolean
  token?: string
  refreshToken?: string
  message?: string
  agentData?: Record<string, unknown>
}
```

Uso:

- login offline
- rehidratacion de sesion

## Secure Storage real

Ademas del cache JSON, la app guarda en secure storage:

- ACCESS_TOKEN
- REFRESH_TOKEN

Esto no reemplaza JsonData, sino que convive con el resto de persistencias.

## Modelo FiscalConfiguration

Archivo:

- fiscal_config.json

Modelo:

```ts
type FiscalConfiguration = {
  implementation: string
  port: string
}
```

Valores observados para implementation:

- pnp
- thefactoryhka
- posvenezuela

Uso:

- seleccionar implementacion fiscal local activa
- resolver puerto COM normalizado

## Modelo FiscalZReportEntry

Persistido dentro de JsonData.fiscalZReports.

```ts
type FiscalZReportEntry = {
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
```

Uso:

- historial local de reportes Z

## Modelo FiscalTestLogEntry

Persistido dentro de JsonData.fiscalTestLogs.

```ts
type FiscalTestLogEntry = {
  implementation: string
  action: string
  success: boolean
  message: string
  source: string
  createdAt: string
}
```

Uso:

- diagnostico y trazas de pruebas fiscales

## Modelo del reporte Z digital consumido por API

No necesariamente se persiste completo, pero si es parte del modelo funcional del sistema y conviene tiparlo en TypeScript.

Estructuras principales observadas:

- DigitalBillingZReportResponse
- DigitalBillingZReportData
- DigitalBillingZReportCompany
- DigitalBillingZReportConsecutiveControl
- DigitalBillingZReportSummary
- DigitalBillingZReportOtherDayCancellations
- DigitalBillingZReportCashRegister
- DigitalBillingZReportAmount
- DigitalBillingZReportSession

Uso:

- reporte Z digital
- cierre de caja
- visualizacion de historial y detalle

## Base de Datos Remota Inferida desde la App

La app cliente no define el esquema del backend, pero se pueden inferir entidades remotas consumidas:

- agents o usuarios de agente
- medications
- orders
- users o clientes
- audit_logs
- digital_billing_documents
- z_reports o cierres de caja

Adicionalmente hay una pista explicita en la serializacion de ordenes:

- sale_type local se envia como Local con comentario para coincidir con MongoDB

Esto sugiere que el backend usa MongoDB al menos para parte del dominio de ordenes, pero este repo no contiene el esquema servidor.

## Tareas para Construir el Proyecto desde Cero

## Alcance recomendado para la migracion TypeScript

Reconstruir por verticales, no por capas aisladas.

### Fase 1. Fundacion tecnica

Tareas:

1. Definir el runtime objetivo:
   - Electron
   - Node desktop shell
   - web con persistencia local alternativa
2. Crear workspace TypeScript.
3. Definir estructura de modulos equivalente a auth, inventory, orders, marketplace, fiscal, reports y audit.
4. Crear cliente HTTP central con:
   - base URL configurable
   - bearer token
   - refresh token
   - interceptores
   - manejo de offline
5. Crear modulo MQTT con soporte TLS, reconnect y protobuf.
6. Integrar generacion de tipos protobuf desde proto/.

### Fase 2. Persistencia local

Tareas:

1. Implementar repositorio de archivos JSON equivalentes a:
   - inventario.json
   - medicamentos.json
   - auth_cache.json
   - auth_response_cache.json
   - users_cache.json
   - fiscal_config.json
2. Implementar almacenamiento seguro para tokens.
3. Separar el modelo raiz JsonData en subrepositorios, aunque se mantenga compatibilidad de archivo durante la transicion.

### Fase 3. Dominio base

Tareas:

1. Portar modelos:
   - Medicine
   - Order
   - Payment
   - UserModel
   - FacturaResponse
   - FiscalConfiguration
2. Portar enums:
   - SaleType
   - SaleStatus
3. Crear mapeadores HTTP y MQTT.

### Fase 4. Casos de uso criticos

Tareas:

1. Login y rehidratacion de sesion.
2. Descarga de medicamentos con fallback local.
3. Sincronizacion de inventario por MQTT.
4. Creacion y sincronizacion de ordenes.
5. Flujo marketplace.
6. Auditoria.
7. Facturacion digital.

### Fase 5. Integraciones especiales

Tareas:

1. Definir estrategia para proveedores fiscales locales:
   - adaptar wrappers nativos
   - moverlos a proceso backend local
   - o mantener un bridge externo
2. Resolver descarga y carga de imagenes.
3. Resolver feed de actualizacion de app si el nuevo runtime lo necesita.

### Fase 6. UI y estado

Tareas:

1. Rehacer vistas por modulo.
2. Rehacer routing.
3. Rehacer stores o state managers.
4. Mantener indicadores offline y de sincronizacion.

### Fase 7. Verificacion funcional

Tareas:

1. Probar login online y offline.
2. Probar create user offline y resincronizacion.
3. Probar venta local con descuento de inventario.
4. Probar recepcion MQTT desde otra terminal.
5. Probar marketplace end to end.
6. Probar facturacion digital.
7. Probar configuracion fiscal local.

## Orden recomendado de implementacion

1. auth
2. storage local
3. medications y stock
4. orders
5. mqtt inventory
6. marketplace_orders
7. audit
8. facturacion digital
9. reports y stats
10. maquina_fiscal

## Riesgos Tecnicos para la Migracion

- JsonData concentra demasiadas responsabilidades.
- Hay endpoints GET con body.
- Hay mezcla de topics en ingles y espanol.
- Hay mezcla de JSON y protobuf para el mismo dominio de inventario.
- El flujo fiscal local depende de bibliotecas Dart y wrappers nativos externos.
- Parte de la sincronizacion ocurre via side effects en providers UI, no solo en servicios.

## Recomendacion Estructural para TypeScript

La reimplementacion deberia dividir el estado actual en bounded contexts claros:

- auth
- inventory
- orders
- marketplace
- users
- audit
- fiscal-local
- fiscal-digital
- reports
- shared-infra

Y separar persistencia por agregado, en lugar de seguir ampliando un solo archivo equivalente a JsonData.