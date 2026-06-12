# Plan de Migracion a TypeScript

## Objetivo

Este plan convierte el analisis del proyecto Flutter en una estrategia de ejecucion concreta para migrar Inventario Medizin a TypeScript sin perder capacidades criticas: offline, MQTT, sincronizacion, facturacion y auditoria.

## Resultado Esperado

Al finalizar la migracion, el sistema TypeScript debe conservar:

- login online y offline
- persistencia local operativa
- sincronizacion de inventario por MQTT
- manejo de ordenes locales y marketplace
- emision de facturacion digital
- integracion o reemplazo controlado de fiscalizacion local
- trazabilidad de auditoria

## Restricciones Detectadas

- El cliente actual mezcla UI, estado, persistencia y side effects en providers.
- Hay endpoints GET con body.
- El sistema MQTT mezcla topics en ingles y espanol.
- Conviven JSON y protobuf en el mismo transporte.
- La persistencia local no es relacional; depende de archivos JSON y secure storage.
- Parte del valor del sistema depende de bibliotecas nativas fiscales que no existen en TypeScript puro.

## Estrategia Recomendada

Migrar por verticales funcionales y no por capas aisladas.

Orden recomendado:

1. Nucleo tecnico.
2. Persistencia local.
3. Auth.
4. Catalogo e inventario.
5. Ordenes.
6. MQTT inventario.
7. Marketplace.
8. Auditoria.
9. Facturacion digital.
10. Fiscal local.
11. Reportes y estadisticas.

## Fase 0. Decisiones de Plataforma

## Objetivo

Congelar el runtime y los limites del nuevo sistema.

## Tareas

1. Definir si el destino sera Electron, Tauri, Node desktop o web.
2. Definir si el proceso fiscal local vivira:
   - dentro del cliente
   - en un servicio local auxiliar
   - o en un backend de borde
3. Definir libreria MQTT del lado TypeScript.
4. Definir estrategia protobuf:
   - ts-proto
   - protobufjs
   - buf generate
5. Definir estrategia de almacenamiento seguro para tokens.
6. Definir si la compatibilidad con archivos JSON locales se mantiene durante la transicion.

## Entregables

- ADR de plataforma
- ADR de transporte MQTT y protobuf
- ADR de persistencia local

## Fase 1. Fundacion Tecnica

## Objetivo

Levantar la base de infraestructura antes de portar negocio.

## Tareas

1. Crear workspace TypeScript.
2. Configurar lint, format y testing.
3. Crear cliente HTTP central con:
   - baseURL configurable
   - inyeccion de token bearer
   - refresh token
   - manejo de timeout
   - normalizacion de errores
4. Crear modulo de almacenamiento seguro.
5. Crear modulo de archivos JSON locales.
6. Generar contratos TypeScript desde .proto.
7. Crear wrapper MQTT con reconnect, TLS y suscripciones tipadas.

## Criterio de salida

- Hay un core ejecutable sin UI que se conecta a API y MQTT.

## Fase 2. Persistencia Local Compatible

## Objetivo

Recrear el comportamiento offline actual.

## Tareas

1. Implementar repositorio compatible con:
   - inventario.json
   - medicamentos.json
   - auth_cache.json
   - auth_response_cache.json
   - users_cache.json
   - fiscal_config.json
2. Implementar serializacion base64 donde hoy existe.
3. Implementar repositorio equivalente a JsonData.
4. Implementar repositorio de usuarios cacheados y marcados con synced.
5. Agregar versionado de esquema local desde el inicio.

## Riesgo

- Mantener JsonData como unico agregado complica la evolucion. Conviene soportarlo por compatibilidad, pero internamente separarlo en repositorios por contexto.

## Fase 3. Auth y Sesion

## Objetivo

Habilitar entrada al sistema y rehidratacion offline.

## Tareas

1. Portar AgentLogin y AgentLoginResponse.
2. Implementar GET /login_agent con body.
3. Implementar POST /auth/refresh-token.
4. Persistir access token y refresh token en storage seguro.
5. Persistir auth_cache.json y auth_response_cache.json.
6. Rehidratar pharmacyId para inicializar MQTT.

## Criterio de salida

- Login online y offline funcionando.

## Fase 4. Catalogo e Inventario

## Objetivo

Portar medicamentos, cache y sincronizacion HTTP inicial.

## Tareas

1. Portar modelo Medicine.
2. Implementar POST /Medications/list con fallback local.
3. Implementar POST /admin/Medications/upsert.
4. Implementar GET /admin/Medications/health.
5. Implementar cache local de medicamentos.
6. Implementar create product y upload de imagenes.

## Criterio de salida

- El cliente carga y guarda inventario con y sin red.

## Fase 5. Ordenes Locales y Sincronizacion HTTP

## Objetivo

Recrear el ciclo de venta y sincronizacion de ordenes.

## Tareas

1. Portar Order, Payment, FacturaResponse y enums.
2. Implementar:
   - POST /admin/Orders/insertorder
   - POST /admin/Orders/orders/local
   - GET /admin/Orders/get
   - GET /admin/Orders/SearchOrders
   - GET /admin/Orders/health
3. Implementar cola local de pendingOrders.
4. Mantener mapeo exacto de sale_type y payments.
5. Preservar numero_control y numero_control_interno.

## Criterio de salida

- Una venta local puede persistirse y sincronizarse con backend.

## Fase 6. MQTT Inventario

## Objetivo

Portar mensajeria tiempo real entre terminales.

## Tareas

1. Implementar conexion TLS a broker.
2. Crear clientId estable por farmacia.
3. Suscribirse a:
   - farmacia/ventas/+
   - farmacia/inventario/+
   - farmacia/alertas/stock
   - pharmacy/{pharmacyId}/insert_inventory
   - pharmacy/{pharmacyId}/update_inventory
   - pharmacy/{pharmacyId}/remove_inventory
4. Implementar publicacion JSON de ventas y alertas.
5. Implementar publicacion y recepcion protobuf de inventario.
6. Corregir la ambiguedad remove_inventory antes de producir el modulo final.

## Criterio de salida

- Dos terminales reflejan cambios de inventario en tiempo real.

## Fase 7. Marketplace

## Objetivo

Portar la recepcion de ordenes marketplace y su ciclo de aceptacion.

## Tareas

1. Generar contratos protobuf del namespace client/.
2. Suscribirse a pharmacy/{pharmacyId}.
3. Parsear OrderContactAndItems.
4. Validar orden y evitar duplicados.
5. Convertir a Order interno.
6. Manejar expiracion de ordenes pendientes.
7. Escuchar order_id/{orderId}/payment_accepted.
8. Al recibir pago aceptado:
   - completar orden
   - descontar inventario
   - publicar remove_inventory
9. Implementar accept_order y negada_order.

## Criterio de salida

- El flujo marketplace funciona end to end.

## Fase 8. Usuarios y Auditoria

## Objetivo

Portar creacion de usuarios offline y trazabilidad.

## Tareas

1. Implementar POST /admin/User/createuser.
2. Implementar POST /admin/User/searchuser/{id}.
3. Crear cache users_cache.json.
4. Implementar sincronizacion de usuarios no sincronizados.
5. Implementar POST y GET /admin/audit/logs.
6. Decidir si se replica la auditoria automatica del cliente HTTP o se mueve a backend.

## Criterio de salida

- Usuarios offline y auditoria funcionales.

## Fase 9. Facturacion Digital

## Objetivo

Portar emision de notas y reporte Z digital.

## Tareas

1. Portar DigitalBillingNoteRequest y DigitalBillingZReportResponse.
2. Implementar:
   - POST /admin/Facturacion/nota_credito
   - POST /admin/Facturacion/nota_debito
   - GET /admin/Facturacion/reporte_z
3. Preservar parsing tolerante de respuestas.
4. Persistir historial local de reportes Z si se mantiene ese feature.

## Criterio de salida

- Facturacion digital usable desde el nuevo cliente.

## Fase 10. Fiscal Local

## Objetivo

Resolver la parte de mayor riesgo tecnico.

## Tareas

1. Catalogar funciones requeridas de:
   - pnp
   - thefactoryhka
   - posvenezuela
2. Definir si se portan wrappers o se exponen via servicio local.
3. Implementar configuracion fiscal local equivalente a fiscal_config.json.
4. Validar reporte Z local, nota de credito local y pruebas de diagnostico.

## Riesgo mayor

- Este punto probablemente no debe implementarse como TypeScript puro. La opcion mas segura es un bridge local o servicio companion.

## Fase 11. Reportes, Stats y UI Final

## Objetivo

Cerrar paridad funcional y operativa.

## Tareas

1. Rehacer dashboards.
2. Rehacer reportes de ventas y stock.
3. Rehacer vistas de configuracion.
4. Integrar actualizacion de app si el runtime elegido lo requiere.
5. Validar monitoreo y logging.

## Matriz de Prioridad

### Critico para MVP

- auth
- persistencia local
- medications
- orders
- mqtt inventario
- marketplace base

### Critico para operacion real

- auditoria
- facturacion digital
- usuarios offline

### Riesgo alto o dependencia externa

- maquina_fiscal
- updater nativo

## Reglas de Aceptacion por Hito

### Hito 1

- Login online y offline.
- Inventario cargado desde API y cache.

### Hito 2

- Venta local sincronizable.
- Actualizacion de inventario por MQTT.

### Hito 3

- Marketplace operativo.
- Usuarios offline operativos.
- Auditoria operativa.

### Hito 4

- Facturacion digital operativa.
- Reportes principales operativos.

### Hito 5

- Fiscal local resuelto o encapsulado via bridge.

## Recomendaciones de Implementacion

- No portar Riverpod como concepto; portar casos de uso y repositorios.
- Separar estado de UI del dominio desde el inicio.
- Normalizar contracts de HTTP y MQTT antes de mover la UI.
- Tratar protobuf como fuente de verdad de mensajes MQTT, no como detalle de implementacion.
- Modelar explicitamente side effects: persistir, publicar, sincronizar, auditar.

## Recomendacion de Equipo

1. Un responsable de arquitectura y contratos.
2. Un responsable de persistencia y offline.
3. Un responsable de integraciones HTTP y MQTT.
4. Un responsable de fiscalizacion local.
5. Un responsable de UI y flujos operativos.

## Siguiente Entregable Recomendado

Despues de este plan, el siguiente entregable natural es un esqueleto de workspace TypeScript con:

- core/http
- core/mqtt
- core/storage
- modules/auth
- modules/inventory
- modules/orders
- modules/marketplace
- modules/fiscal
- shared/contracts