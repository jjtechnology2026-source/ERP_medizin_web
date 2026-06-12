# Documentacion MQTT y Protocol Buffers

## Objetivo

Este documento describe los flujos MQTT reales que usa Inventario Medizin, los topics, el formato de carga util y los mensajes Protocol Buffers involucrados. Esta referencia esta pensada para una migracion a TypeScript, por lo que prioriza contratos de mensajeria, direccion del flujo y reglas de negocio observadas en el cliente Flutter.

## Resumen Ejecutivo

- El cliente MQTT se crea por farmacia y usa un clientId estable con formato medizin_terminal_{pharmacyId}.
- La conexion usa TLS sobre el broker EMQX configurado en el cliente.
- Conviven dos estilos de mensajes:
  - JSON plano para ventas, alertas y sincronizacion simple.
  - Protocol Buffers para inventario, marketplace y ordenes pendientes.
- El cliente escucha actualizaciones de otras maquinas y sincroniza el inventario local en disco.
- El flujo marketplace tambien depende de MQTT para recibir ordenes remotas y confirmar pagos.

## Configuracion de Conexion

Fuente principal observada en la app:

- Broker: v1106ae1.ala.us-east-1.emqxsl.com
- Puerto: 8883
- QoS por defecto: atLeastOnce
- KeepAlive: 20 segundos
- Conexion segura: true
- Auto reconnect: true
- Resubscribe automatico: true

Notas importantes para el port a TypeScript:

- Aunque existe un archivo de secretos con variables MQTT, la implementacion actual usa valores hardcodeados en la configuracion MQTT.
- La autenticacion MQTT tambien esta hardcodeada en el connect message con usuario inventario_medizin y password prueba1234.
- La sesion funcional real depende de pharmacyId. Sin ese dato, el provider MQTT no se inicializa.

## Punto de Entrada del Flujo MQTT

El flujo se arma asi:

1. Login exitoso del agente.
2. Se guarda pharmacyId en sessionProvider.
3. Se invalida y reconstruye mqttServiceProvider.
4. Se crea MqttService con clientId medizin_terminal_{pharmacyId}.
5. Se conecta al broker.
6. Se suscribe automaticamente a topics de inventario y marketplace.
7. Se inicializan listeners de sincronizacion en providers globales.

## Topics Suscritos Automaticamente

Cuando el cliente se conecta, se suscribe a estos topics:

### Inventario y ventas

- farmacia/ventas/+
- farmacia/inventario/+
- farmacia/alertas/stock
- pharmacy/{pharmacyId}/insert_inventory
- pharmacy/{pharmacyId}/update_inventory
- pharmacy/{pharmacyId}/remove_inventory

### Marketplace y ordenes remotas

- pharmacy/{pharmacyId}
- farmacia/ordenes/pendientes/+
- farmacia/ordenes/confirmacion/+

### Observacion de compatibilidad

La app mezcla namespaces en espanol e ingles:

- farmacia/... para flujos JSON y ordenes pendientes.
- pharmacy/... para flujos protobuf de inventario y marketplace.
- client/... para mensajes originados desde clientes o marketplace.

Al migrar a TypeScript conviene centralizar esta taxonomia en un solo modulo de contratos MQTT.

## Topics Publicados por la App

### Flujos JSON

#### Venta individual de medicamento

Topic:

- farmacia/ventas/{barCode}

Payload JSON enviado:

```json
{
  "ventaId": "V1710000000000",
  "orderId": "01H...",
  "medicamento": "Acetaminofen",
  "barCode": "7591234567890",
  "cantidad": 2,
  "precio": 3.5,
  "total": 7,
  "timestamp": "2026-04-20T10:30:00.000Z",
  "cajero": "juan.perez",
  "clientId": "medizin_terminal_123"
}
```

Uso:

- Replica ventas entre terminales.
- Otros clientes filtran mensajes cuyo clientId es distinto al suyo.

#### Venta completa de una orden

Topic:

- farmacia/ordenes/{orderId}/venta

Payload JSON enviado:

```json
{
  "orderId": "01H...",
  "clientName": "Cliente General",
  "clientId": "V12345678",
  "totalSystem": 10,
  "totalReal": 10,
  "medications": [
    {
      "barCode": "7591234567890",
      "name": "Acetaminofen",
      "quantity": 2,
      "price": 3.5,
      "total": 7
    }
  ],
  "timestamp": "2026-04-20T10:30:00.000Z",
  "saleType": "local",
  "clientIdMqtt": "medizin_terminal_123"
}
```

Uso:

- Publica la orden completa.
- Ademas dispara publicaciones individuales por cada medicamento vendido.

#### Actualizacion de inventario

Topic:

- farmacia/inventario/{barCode}

Payload JSON enviado:

```json
{
  "medicamento": "Acetaminofen",
  "barCode": "7591234567890",
  "stockAnterior": 20,
  "stockNuevo": 18,
  "diferencia": -2,
  "razon": "venta",
  "timestamp": "2026-04-20T10:30:00.000Z",
  "clientId": "medizin_terminal_123"
}
```

Uso:

- Sincroniza stock remoto entre terminales.
- El receptor sobreescribe stock local con stockNuevo.

#### Alerta de stock

Topic:

- farmacia/alertas/stock

Payload JSON enviado:

```json
{
  "medicamento": "Acetaminofen",
  "barCode": "7591234567890",
  "stockActual": 2,
  "stockMinimo": 5,
  "nivel": "BAJO",
  "timestamp": "2026-04-20T10:30:00.000Z",
  "clientId": "medizin_terminal_123"
}
```

Uso:

- Notifica agotado o bajo stock.
- La implementacion actual solo loguea el evento; no hay accion visual fuerte unificada.

## Flujos Protobuf de Inventario

La aplicacion usa el mensaje DtoUpdateMedications para tres operaciones reales:

- Insertar inventario.
- Actualizar inventario.
- Remover inventario por venta.

### Topics protobuf de inventario

- pharmacy/{pharmacyId}/insert_inventory
- pharmacy/{pharmacyId}/update_inventory
- pharmacy/{pharmacyId}/remove_inventory

### Mensaje principal: DtoUpdateMedications

Definicion consolidada observada en proto/dto.proto y proto/medicine.proto:

```proto
message DtoUpdateMedications {
  string id_agent = 1;
  string id_pharmacy = 2;
  repeated MedicationProto medications = 3;
}

message MedicationProto {
  string brand = 1;
  string active_ingredient = 2;
  string dosage = 3;
  string tablets = 4;
  string bar_code = 5;
  string name = 6;
  string image = 7;
  string category = 8;
  string subcategory = 9;
  double price = 10;
  double quantity = 11;
  double stock = 12;
  string description = 13;
  bool controlled = 14;
  double vat = 15;
  bool antibiotic = 16;
  double minimum = 17;
}
```

### Semantica operativa por topic

#### pharmacy/{pharmacyId}/insert_inventory

Que manda:

- Alta de un medicamento nuevo o lote insertado.
- Lista de medicamentos completa en formato protobuf.

Que hace el receptor:

- Convierte cada MedicationProto a Medicine.
- Si el barCode ya existe, actualiza.
- Si no existe, agrega el medicamento al inventario local.

#### pharmacy/{pharmacyId}/update_inventory

Que manda:

- Medicamentos editados remotamente.

Que hace el receptor:

- Misma ruta que insert_inventory.
- Update por barCode.

#### pharmacy/{pharmacyId}/remove_inventory

Que manda:

- La venta de una orden como reduccion de stock.
- En los mensajes emitidos por caja, quantity representa cantidad vendida y stock representa stock restante.

Que hace el receptor:

- Itera medicamentos.
- Toma medDto.quantity y lo usa como nuevo stock en updateMedicineStock.

Riesgo detectado para la migracion:

- En el receptor actual hay una ambiguedad semantica: para remove_inventory se usa quantity como nuevo stock, aunque el emisor tambien calcula stock restante en el campo stock. Esto debe corregirse o normalizarse en TypeScript para evitar divergencia de inventario.

## Flujos Protobuf de Marketplace Cliente -> Farmacia

Estos mensajes salen y entran por el namespace client/.

### 1. Busqueda inicial de medicamentos

Topic:

- client/{clientId}/orden/{orderId}/search_medicine

Mensaje protobuf:

```proto
message OrderDto {
  string order_id = 1;
  repeated MedicineDto medicines = 2;
  GeoJSONPoint geolocation = 3;
}

message MedicineDto {
  string name = 1;
  string image = 2;
  string medicine_id = 3;
  uint32 quantity = 4;
}

message GeoJSONPoint {
  double latitude = 1;
  double longitude = 2;
}
```

Que manda:

- order_id
- lista de medicamentos buscados
- geolocalizacion del cliente

Que espera provocar:

- La farmacia reciba la solicitud y evalue disponibilidad.

### 2. Datos de contacto del cliente

Topic:

- client/{clientId}/orden/{orderId}/data

Mensaje protobuf:

```proto
message ContactLocation {
  string name = 1;
  string cedula = 2;
  string address = 3;
  string phone = 4;
  double latitude = 5;
  double longitude = 6;
}
```

Que manda:

- nombre
- cedula
- direccion
- telefono
- latitud
- longitud

Que usa la app:

- Completar informacion de despacho o retiro.

### 3. Seleccion de farmacia

Topic:

- client/{clientId}/orden/{orderId}/pharmacy_choice

Mensaje protobuf:

```proto
message OrderContactAndItems {
  string order_id = 1;
  string pharmacy_id = 2;
  string client_name = 3;
  string client_address = 4;
  string client_id_number = 5;
  string client_phone = 6;
  string cliente_email = 7;
  repeated OrderItem items = 8;
}

message OrderItem {
  string barcode = 1;
  int32 quantity = 2;
}
```

Que manda:

- orden elegida
- farmacia seleccionada
- datos del cliente
- items por barcode y quantity

Que hace el receptor en la app:

- Valida el mensaje.
- Busca inventario local.
- Mapea a Order interno.
- Inserta la orden en orderMarketplace.
- Si vence el tiempo de espera, la marca como cancelada.

### 4. Validacion de pago

Topic:

- client/{clientId}/orden/{orderId}/payment

Payload:

- Sin payload util. La app publica un Uint8List vacio.

Uso:

- Dispara la validacion de pago en otro componente del ecosistema.

## Flujos Protobuf de Farmacia -> Cliente o Integraciones Externas

### Aceptacion de orden

Topic:

- pharmacy/{pharmacyId}/orden_id/{orderId}/accept_order

Mensaje protobuf:

```proto
message AcceptOrder {
  string pharmacy_id = 1;
  string order_id = 2;
}
```

Uso:

- Confirma aceptacion de la orden por la farmacia.

### Rechazo de orden

Topic:

- pharmacy/{pharmacyId}/orden_id/{orderId}/negada_order

Mensaje protobuf:

```proto
message RejectedOrder {
  string pharmacy_id = 1;
  string order_id = 2;
  string reason = 3;
}
```

Uso:

- Rechaza la orden y opcionalmente explica la causa.

### Confirmacion de pago aceptado

Topic observado por listener:

- order_id/{orderId}/payment_accepted

Payload:

- El listener no parsea payload; usa solo el topic.

Que hace la app al recibirlo:

- Busca la orden marketplace local.
- La cambia a Completed y saleType delivery.
- Publica remove_inventory por MQTT.
- Descuenta inventario local.
- Guarda cambios en disco.

## Flujos de Ordenes Pendientes entre Terminales

La app tiene un provider adicional para ordenes pendientes locales, usando topics en espanol.

### Publicacion de orden pendiente

Topic:

- farmacia/ordenes/pendientes/{orderId}

Mensaje protobuf:

```proto
message OrderProto {
  google.protobuf.Timestamp date = 1;
  string id_order = 2;
  string name_group = 3;
  string id_agent = 4;
  string name_agent = 5;
  string id_pharmacy = 6;
  string id_group = 7;
  repeated MedicineProto medications = 8;
  double totalreal = 9;
  double totalsystem = 10;
  string client_name = 11;
  string client_last_name = 12;
  string client_id = 13;
  repeated PaymentProto payments = 14;
  double rate = 15;
  string gender = 16;
  SaleStatusProto sale_status = 17;
  bool is_controlled = 18;
  SaleTypeProto sale_type = 19;
  string address = 20;
  string pharmacy = 21;
}
```

Tipos auxiliares usados:

```proto
enum SaleTypeProto {
  LOCAL = 0;
  DELIVERY = 1;
  PICKUP = 2;
}

enum SaleStatusProto {
  PENDING = 0;
  COMPLETED = 1;
  CANCELLED = 2;
}

message PaymentProto {
  oneof payment_type {
    CashPaymentProto cash = 1;
    DollarsPaymentProto dollars = 2;
    MobilePaymentProto mobile = 3;
    CardPaymentProto card = 4;
    BiopagoPaymentProto biopago = 5;
  }
}
```

Que manda:

- La orden pendiente completa serializada.

Que hace el receptor hoy:

- La recibe y parsea.
- El procesamiento posterior no esta terminado; el codigo deja comentario para futura logica.

### Confirmacion de sincronizacion

Topic escuchado:

- farmacia/ordenes/confirmacion/{orderId}

Payload:

- No se usa en la implementacion actual.

Uso actual:

- El provider solo extrae orderId desde el topic y registra el evento.

## Mapeo de Responsabilidades por Provider

### MqttService

Responsabilidades:

- Conexion, reconexion y suscripcion.
- Publicacion JSON y protobuf.
- Parseo de payloads.
- Exposicion de streams filtrados por topic.

### MqttInventoryManager

Responsabilidades:

- Escuchar ventas de otras maquinas.
- Escuchar updates de inventario.
- Escuchar alertas de stock.
- Escuchar protobuf de insert_inventory, update_inventory y remove_inventory.
- Aplicar cambios sobre el inventario local.

### MarketplaceOrdersResponseNotifier

Responsabilidades:

- Escuchar pharmacy/{pharmacyId}.
- Parsear OrderContactAndItems.
- Crear ordenes marketplace locales.
- Cancelar ordenes expiradas.
- Reaccionar a payment_accepted.

### MqttPendingOrdersManager

Responsabilidades:

- Publicar ordenes pendientes locales.
- Escuchar ordenes pendientes remotas.
- Escuchar confirmaciones de sincronizacion.

## Reglas de Negocio Relevantes para la Migracion a TypeScript

- El MQTT depende de pharmacyId, no solo del login.
- Los topics del marketplace y de inventario no siguen una sola convencion de idioma.
- Hay mezcla de JSON y protobuf en el mismo cliente; no conviene abstraerlos como si fueran iguales.
- El provider de inventario hace side effects directos sobre persistencia local.
- La semantica de remove_inventory debe normalizarse antes del port.
- Los mensajes payment_accepted se infieren por nombre del topic, no por payload.
- Hay listeners que hoy solo registran eventos pero no completan el flujo de negocio.

## Recomendacion de Diseno para TypeScript

Separar la migracion MQTT en capas:

1. Contratos de topics.
2. Contratos de payload JSON.
3. Contratos protobuf generados desde .proto.
4. Adaptadores de transporte MQTT.
5. Casos de uso de inventario, marketplace y ordenes pendientes.
6. Persistencia local desacoplada del listener.

## Checklist Minimo de Paridad

- Conexion TLS con reconnect automatico.
- ClientId estable por farmacia.
- Suscripcion a todos los topics listados.
- Soporte para JSON y protobuf.
- Recepcion y aplicacion de insert_inventory, update_inventory y remove_inventory.
- Recepcion de marketplace en pharmacy/{pharmacyId}.
- Procesamiento de payment_accepted.
- Emision de accept_order y negada_order.
- Publicacion de ordenes pendientes si ese flujo se conserva.