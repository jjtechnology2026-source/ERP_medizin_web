# Matriz Flutter -> TypeScript

## Objetivo

Esta matriz traduce el proyecto actual a una organizacion sugerida en TypeScript. No replica carpetas literalmente: propone como separar responsabilidades para que el port sea mantenible.

## Convencion Propuesta

- core: infraestructura transversal
- modules: dominios funcionales
- shared: contratos y utilidades compartidas
- appshell: UI, routing y bootstrap del runtime

## Matriz por Modulo

| Flutter actual | Responsabilidad actual | Modulo sugerido en TypeScript | Tareas principales |
| --- | --- | --- | --- |
| lib/auth | login, sesion, tokens, cache auth | modules/auth | portar login, refresh, cache offline, estado de sesion |
| lib/audit | auditoria y consulta de logs | modules/audit | portar requests de auditoria, filtros, parser de paginas |
| lib/cash_register | construccion de ventas y pagos | modules/cash-register | separar carrito, pagos, cierre de orden, side effects MQTT |
| lib/controlled_medications | vistas y reglas de controlados | modules/controlled-medications | portar reglas, filtros y vistas especializadas |
| lib/create_product | alta de producto, importacion, imagenes | modules/products | portar create product, upload image, importacion masiva |
| lib/marketplace_orders | ordenes remotas por MQTT | modules/marketplace | portar listener, mapper, validator, aceptacion, rechazo y pago aceptado |
| lib/orders | ordenes, facturacion digital y sincronizacion | modules/orders | portar repositorio HTTP, sincronizacion y notas digitales |
| lib/reports | reportes operativos | modules/reports | portar agregaciones, formatos y salidas de reporte |
| lib/stats | metricas y estadisticas | modules/stats | portar consultas, mapeadores y datasets para UI |
| lib/stock | inventario y vistas de stock | modules/inventory | portar consultas de inventario, reglas de stock y vistas |
| lib/system_configuration | configuracion y diagnostico fiscal | modules/system-configuration | portar fiscal config, diagnostico, reportes Z historicos |
| lib/maquina_fiscal | integracion fiscal local nativa | modules/fiscal-local o bridge externo | encapsular dependencias nativas, definir frontera de proceso |
| lib/shape | nucleo compartido, modelos, MQTT, providers base | core + shared + partes de modules | desarmar shape en contratos, infraestructura y dominio |
| lib/shared | rutas locales, JSON store, componentes comunes | shared + core/storage | portar utilidades locales y componentes comunes |
| lib/User_Panel | panel de usuario | modules/user-panel | portar vistas agregadas y metricas de panel |
| lib/config | router, theme, config, key vault | appshell/config + core/config | portar bootstrap, configuracion y entorno |
| lib/main.dart | arranque e inicializacion | appshell/bootstrap | levantar runtime, auth, mqtt, sync y routing |

## Desarme Recomendado de shape

shape hoy concentra demasiadas cosas. En TypeScript deberia romperse asi:

| Origen en Flutter | Destino sugerido |
| --- | --- |
| shape/models | shared/contracts |
| shape/services | core/http o modules/*/infra |
| shape/mqtt | core/mqtt |
| shape/providers/data_json | core/storage + modules/session |
| shape/providers/connectivity | core/connectivity |
| shape/helpers | shared/utils |
| shape/components | shared/ui |
| shape/application/use_case | modules/*/application |

## Equivalencia de Infraestructura

| Flutter actual | TypeScript sugerido |
| --- | --- |
| DioClient | core/http/http-client |
| FlutterSecureStorage | core/storage/secure-store |
| JsonFileStore | core/storage/json-file-store |
| mqtt5_client | core/mqtt/mqtt-client |
| generated/proto | shared/proto-generated |
| Riverpod providers | application services + state stores |
| GoRouter | appshell/router |

## Casos de Uso a Crear en TypeScript

### auth

- authenticateAgent
- refreshSessionToken
- loadOfflineSession
- persistSession

### inventory

- loadMedicines
- upsertMedicines
- applyInventoryUpdateFromMqtt
- publishInventoryRemoval
- publishStockAlert

### orders

- createLocalOrder
- syncPendingOrders
- fetchOrders
- searchOrders
- prepareOrderForSubmission

### marketplace

- receiveMarketplaceOrder
- validateMarketplaceOrder
- acceptMarketplaceOrder
- rejectMarketplaceOrder
- handlePaymentAccepted

### users

- createUser
- searchUser
- syncUnsyncedUsers

### audit

- logAuditEvent
- fetchAuditLogs

### fiscal-digital

- issueCreditNote
- issueDebitNote
- fetchZReport

### fiscal-local

- processFiscalOperation
- printLocalCreditNote
- runFiscalDiagnostics

## Dependencias Externas a Resolver

| Dependencia actual | Uso | Estrategia sugerida |
| --- | --- | --- |
| thefactory | fiscal local | mover a bridge local o servicio companion |
| posv | fiscal local | mover a bridge local o servicio companion |
| pnpdll_dart | fiscal local | mover a bridge local o servicio companion |
| mqtt5_client | MQTT | reemplazar por cliente MQTT TypeScript con TLS |
| protobuf | mensajes binarios | generar codigo TypeScript desde proto |
| flutter_secure_storage | tokens | reemplazar por secret store del runtime elegido |
| open_filex | instalador y updater | reevaluar segun runtime |

## Secuencia Recomendada de Port

1. core/config
2. core/http
3. core/storage
4. shared/contracts
5. modules/auth
6. modules/inventory
7. modules/orders
8. core/mqtt
9. modules/marketplace
10. modules/users
11. modules/audit
12. modules/fiscal-digital
13. modules/fiscal-local
14. modules/reports
15. modules/stats
16. appshell/ui

## Decisiones Importantes que No Conviene Postergar

1. Si fiscal local sera un bridge y no una libreria interna.
2. Si se mantendra compatibilidad con los JSON locales actuales.
3. Si el runtime final necesita offline estricto en escritorio o una modalidad conectada.
4. Si la auditoria automatica quedara del lado cliente o servidor.
5. Si los topics MQTT se normalizaran o se preservaran tal cual.