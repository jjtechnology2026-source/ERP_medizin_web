# Documentacion de APIs Consumidas

## Objetivo

Este documento enumera las APIs HTTP consumidas por la aplicacion, agrupadas por modulo funcional. Para cada endpoint se detalla que envia la app, que espera recibir y que papel cumple dentro del sistema. La idea es facilitar una reimplementacion en TypeScript sin perder contratos ni efectos secundarios.

## Base URL y Reglas Transversales

### Base URL principal

- Base por defecto: https://medizins.com

### Cliente HTTP principal

La mayoria de endpoints se consumen con un cliente Dio global que agrega:

- Content-Type: application/json
- Authorization: Bearer {accessToken}, salvo endpoints marcados con skipAuth
- Refresh token automatico al recibir 401 o 403
- Auditoria automatica para POST, PUT, PATCH y DELETE considerados mutantes

### Refresh token

Endpoint:

- POST /auth/refresh-token

Que manda:

```json
{
  "token": "refresh-token"
}
```

Que espera recibir:

```json
{
  "token": "nuevo-access-token",
  "refreshToken": "nuevo-refresh-token"
}
```

Variantes aceptadas por el parser:

- token
- accessToken
- access_token
- refreshToken
- refresh_token

Uso:

- Renovar sesion sin relogin.

## Modulo Auth

### Login de agente

Endpoint:

- GET /login_agent

Que manda:

La app envia el body JSON aun siendo GET:

```json
{
  "user": "usuario",
  "password": "clave",
  "lastLogin": "2026-04-20T10:30:00.000Z"
}
```

lastLogin es opcional.

Que espera recibir:

```json
{
  "token": "jwt",
  "refresh_token": "refresh",
  "agentId": "agent-1",
  "agentUsername": "juan.perez",
  "pharmacyName": "Sucursal Centro",
  "pharmacyId": "pharmacy-1",
  "rif": "J123456789",
  "groupId": "group-1",
  "groupName": "Grupo Medizin",
  "email": "agent@empresa.com",
  "sanitaryRegistrationNumber": "...",
  "mppRegistration": "...",
  "birthDate": "...",
  "phoneNumber": "...",
  "permitsArray": [],
  "role": "admin",
  "usesDigitalBilling": true
}
```

Campos minimos que el cliente considera obligatorios para login exitoso:

- token
- refresh_token
- agentId
- agentUsername
- pharmacyName
- pharmacyId

Que retorna internamente la app:

- AgentLoginResponse con success, token, refreshToken, message y agentData.

Notas de migracion:

- El endpoint hoy rompe la convencion REST al usar GET con body.
- TypeScript deberia preservar este comportamiento mientras el backend no cambie.

## Modulo Orders

### Insertar ordenes sincronizadas

Endpoint:

- POST /admin/Orders/insertorder

Que manda:

Un arreglo de ordenes. Cada orden se serializa asi:

```json
[
  {
    "date": "2026-04-20T10:30:00.000Z",
    "id": "01H...",
    "nameGroup": "Grupo",
    "idAgent": "agent-1",
    "nameAgent": "juan.perez",
    "idPharmacy": "pharmacy-1",
    "idGroup": "group-1",
    "medications": [
      {
        "brand": "Genfar",
        "activeIngredient": "Acetaminofen",
        "dosage": "500mg",
        "tablets": "10",
        "barCode": "7591234567890",
        "name": "Acetaminofen",
        "image": "acetaminofen.webp",
        "category": "Analgesicos",
        "subcategory": "Tabletas",
        "price": 3.5,
        "quantity": 2,
        "stock": 18,
        "description": "...",
        "controlled": false,
        "vat": 16,
        "antibiotic": false,
        "minimum": 5
      }
    ],
    "totalreal": 7,
    "totalsystem": 7,
    "rifEmisor": "J123456789",
    "client": {
      "id": "V12345678",
      "name": "Juan Perez",
      "email": "juan@correo.com",
      "direccion": "Caracas",
      "phone": "04141234567",
      "documento": "V12345678"
    },
    "payments": [
      {
        "runtimeType": "Cash",
        "type": "cash",
        "change": 0,
        "amount": 7
      }
    ],
    "numero_control": "A000123",
    "facturacion": {
      "success": true,
      "numero_control": "A000123",
      "resp": {
        "numerointerno": "INT-1",
        "numerocontrol": "A000123",
        "trackingid": "TRACK-1",
        "urlpdf": "https://...",
        "fecha": "2026-04-20"
      },
      "error": null
    },
    "rate": 36.5,
    "gender": "Male",
    "sale_status": "Completed",
    "is_controlled": false,
    "sale_type": "Local",
    "address": "Caracas",
    "pharmacy": "Sucursal Centro"
  }
]
```

Que espera recibir:

- 200 o 201 para exito.
- En insertOrderWithDetails el cliente intenta extraer la orden persistida desde:
  - una lista en la raiz,
  - un objeto data con lista,
  - o un objeto equivalente a la orden.

Que retorna internamente la app:

- insertOrders: bool
- insertOrderWithDetails: objeto con success, statusCode, message, details y order opcional

### Insertar ordenes fiscales locales

Endpoint:

- POST /admin/Orders/orders/local

Que manda:

- Mismo contrato de insertorder.
- Adicionalmente incluye numero_control_interno.

Que espera recibir:

- 200 o 201.

Uso:

- Persistir ordenes procesadas por flujo fiscal local.

### Health de ordenes

Endpoint:

- GET /admin/Orders/health

Que manda:

- Sin body.

Que espera recibir:

- 200 si el servicio esta disponible.

Que retorna internamente la app:

- bool

### Obtener ordenes del agente

Endpoint:

- GET /admin/Orders/get

Que manda:

- Sin body.

Que espera recibir:

- Lista JSON de ordenes parseables como Order.

Que retorna internamente la app:

- List<Order> o null

### Buscar ordenes por filtros

Endpoint:

- GET /admin/Orders/SearchOrders

Query params soportados por el cliente:

- id_group
- id_pharmacy
- date.start en ISO UTC
- date.end en ISO UTC
- type_sale

Ejemplo:

```http
GET /admin/Orders/SearchOrders?id_group=group-1&id_pharmacy=pharmacy-1&type_sale=delivery
```

Que espera recibir:

- Lista JSON de ordenes.

Que retorna internamente la app:

- List<Order> o null

## Modulo Medications e Inventario

### Upsert de medicamentos

Endpoint:

- POST /admin/Medications/upsert

Que manda:

Un arreglo de medicamentos:

```json
[
  {
    "brand": "Genfar",
    "activeIngredient": "Acetaminofen",
    "dosage": "500mg",
    "tablets": "10",
    "barCode": "7591234567890",
    "name": "Acetaminofen",
    "image": "acetaminofen.webp",
    "category": "Analgesicos",
    "subcategory": "Tabletas",
    "price": 3.5,
    "quantity": 18,
    "stock": 18,
    "description": "...",
    "controlled": false,
    "vat": 16,
    "antibiotic": false,
    "minimum": 5
  }
]
```

Que espera recibir:

- 200 o 201.

Que retorna internamente la app:

- bool

### Health de medicamentos

Endpoint:

- GET /admin/Medications/health

Que manda:

- Sin body.

Que espera recibir:

- 200.

Que retorna internamente la app:

- bool

### Listado de medicamentos

Endpoint:

- POST /Medications/list

Que manda:

- Body literal string "null"
- Header Authorization Bearer token

Que espera recibir:

Dos variantes aceptadas:

```json
[
  {
    "brand": "Genfar",
    "activeIngredient": "Acetaminofen"
  }
]
```

o

```json
{
  "medications": [
    {
      "brand": "Genfar",
      "activeIngredient": "Acetaminofen"
    }
  ]
}
```

Que retorna internamente la app:

- List<Medicine>
- Si falla, intenta cargar medicamentos.json local como fallback

Observaciones:

- Este endpoint no sigue el prefijo /admin.
- La app guarda la respuesta en un cache local base64.

### Crear producto

Endpoint:

- POST /Medications/Create

Que manda:

- json.encode(productData), donde productData es una lista de mapas.

Payload tipico esperado por el modulo create_product:

```json
[
  {
    "brand": "Genfar",
    "activeIngredient": "Acetaminofen",
    "dosage": "500mg",
    "barCode": "7591234567890",
    "name": "Acetaminofen",
    "category": "Analgesicos",
    "subcategory": "Tabletas",
    "price": 3.5,
    "stock": 20,
    "description": "...",
    "controlled": false,
    "vat": 16,
    "antibiotic": false,
    "minimum": 5
  }
]
```

Que espera recibir:

- Response HTTP generico. El servicio expone el Response completo.

### Subir imagen de medicamento

Endpoint:

- POST /admin/MedicationImage/Upload

Que manda:

```json
{
  "name": "acetaminofen.webp",
  "data": [137, 80, 78, 71]
}
```

Que espera recibir:

- Response HTTP generico con informacion de la imagen o confirmacion.

Que retorna internamente la app:

- Response completo de Dio

### Descargar imagen de medicamento

Endpoint observado en UI:

- GET https://backendadministrativo-production.up.railway.app/admin/MedicationImage/download/{imageUrl}

Uso:

- Renderizar imagen remota por nombre de archivo.

Observacion:

- Este flujo no usa la base URL principal. En TypeScript conviene aislarlo como un asset endpoint externo.

## Modulo User

### Crear usuario

Endpoint:

- POST /admin/User/createuser

Que manda:

```json
{
  "id": "V12345678",
  "name": "Juan Perez",
  "email": "juan@correo.com",
  "direccion": "Caracas",
  "documento": "V12345678",
  "phone": "04141234567"
}
```

Que espera recibir:

- 200 o 201 para exito.

Que hace adicionalmente la app:

- Si sale bien, guarda usuario local con synced true.
- Si falla, lo guarda con synced false para sincronizar luego.

Que retorna internamente la app:

- bool

### Buscar usuario por id

Endpoint:

- POST /admin/User/searchuser/{id}

Que manda:

- Sin body util.

Que espera recibir:

```json
{
  "id": "V12345678",
  "name": "Juan Perez",
  "email": "juan@correo.com",
  "direccion": "Caracas",
  "documento": "V12345678",
  "phone": "04141234567"
}
```

Que hace la app si falla red:

- Busca el usuario en users_cache.json.

Que retorna internamente la app:

- UserSearchResult con user y fromCache

### Reintento de usuarios no sincronizados

Endpoint usado internamente:

- POST /admin/User/createuser

Que manda:

- Los mismos datos de UserModel tomados del cache local.

Que espera recibir:

- 200 o 201 para marcar synced true.

## Modulo Audit

### Crear log de auditoria

Endpoint:

- POST /admin/audit/logs

Que manda:

```json
{
  "action": "CREATE",
  "entity_name": "user",
  "entity_id": "user:V12345678",
  "old_values": null,
  "new_values": {
    "id": "V12345678",
    "name": "Juan Perez"
  },
  "user_name": "juan.perez",
  "userName": "juan.perez",
  "agent_username": "juan.perez",
  "agentUsername": "juan.perez",
  "user_agent": "Inventario Medizin"
}
```

Que espera recibir:

- 200 o 201.

Que retorna internamente la app:

- bool

Observacion:

- El DioClient tambien envia auditoria automatica para muchas operaciones de escritura usando este mismo endpoint.

### Consultar logs de auditoria

Endpoint:

- GET /admin/audit/logs

Query params soportados:

- entity_name
- entity_id
- user_id
- action
- start_date
- end_date
- limit
- offset

Que espera recibir:

La app tolera multiples formatos. Puede parsear:

```json
{
  "items": [],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

o variantes dentro de data, result o payload.

Que retorna internamente la app:

- AuditLogPage

## Modulo Facturacion Digital

### Emitir nota de credito

Endpoint:

- POST /admin/Facturacion/nota_credito

Que manda:

```json
{
  "id_pharmacy": "pharmacy-1",
  "entidad": "SMART",
  "tasa_cambio": 36.5,
  "rif_emisor": "J123456789",
  "tracking_id": "TRACK-1",
  "numero_control_interno": "INT-1",
  "cliente": {
    "rif": "V12345678",
    "razon_social": "Juan Perez",
    "direccion": "Caracas",
    "telefono": "04141234567",
    "correo": "juan@correo.com"
  },
  "documento_afectado": {
    "numero_documento": "A000123",
    "fecha_emision": "2026-04-20",
    "monto_total": 7,
    "motivo": "Devolucion"
  },
  "items": [
    {
      "descripcion": "Acetaminofen",
      "codigo_plu": "7591234567890",
      "cantidad": 2,
      "precio_unitario": 3.5,
      "vat": 16,
      "es_exento": false
    }
  ]
}
```

Que espera recibir:

El parser tolera respuestas como:

```json
{
  "success": true,
  "numero_control": "NC0001",
  "resp": {
    "numerointerno": "INT-NC-1",
    "numerocontrol": "NC0001",
    "trackingid": "TRACK-NC-1",
    "urlpdf": "https://...",
    "fecha": "2026-04-20"
  },
  "error": null
}
```

Que retorna internamente la app:

- DigitalBillingNoteResult

### Emitir nota de debito

Endpoint:

- POST /admin/Facturacion/nota_debito

Que manda:

- Mismo contrato que nota_credito.

Que espera recibir:

- Misma estructura de FacturaResponse.

Que retorna internamente la app:

- DigitalBillingNoteResult

### Generar reporte Z digital

Endpoint:

- GET /admin/Facturacion/reporte_z

Query params requeridos:

- fecha
- rif
- id_pharmacy
- entidad

Query param opcional:

- sucursa

Ejemplo:

```http
GET /admin/Facturacion/reporte_z?fecha=2026-04-20&rif=J123456789&id_pharmacy=pharmacy-1&entidad=SMART&sucursa=001
```

Que espera recibir:

- Un payload compatible con DigitalBillingZReportResponse.
- El parser soporta tanto estructura legacy fiscal como estructura de cierre de caja.

Campos relevantes que puede retornar el backend:

- empresa
- Fecha_Reporte
- control_consecutivos
- ReporteZ
- anulaciones_otros_dias
- sucursal
- fecha
- caja
- fondo_inicial
- fondo_final
- total_ventas
- total_gastos
- total_retirado
- diferencia_acumulada
- cantidad_turnos
- detalle_sesiones

Que retorna internamente la app:

- DigitalBillingZReportResult con report y rawPayloadJson

## Modulo General y Auxiliar

### Tasa de cambio

Endpoint:

- GET /Rate

Que manda:

Aunque es GET, la app envia data:

```json
{
  "Moneda": "USD",
  "Fechavalor": "2026-04-20"
}
```

Que espera recibir:

```json
{
  "tipocambio": 36.5
}
```

Que retorna internamente la app:

- Stream<double>

Observacion:

- Hace polling cada 1 minuto.

### Feed de actualizacion de app

Endpoint:

- GET https://medizins.com/updateApp/checkLatestVersion

Que espera recibir:

- XML tipo appcast con item y enclosure.
- Atributos usados:
  - sparkle:version
  - url

Que retorna internamente la app:

- Un mapa con version, url y notes si hay version mas nueva.

## Resumen por Modulo

### auth

- GET /login_agent
- POST /auth/refresh-token

### orders

- POST /admin/Orders/insertorder
- POST /admin/Orders/orders/local
- GET /admin/Orders/health
- GET /admin/Orders/get
- GET /admin/Orders/SearchOrders

### medications y stock

- POST /admin/Medications/upsert
- GET /admin/Medications/health
- POST /Medications/list
- POST /Medications/Create
- POST /admin/MedicationImage/Upload
- GET https://backendadministrativo-production.up.railway.app/admin/MedicationImage/download/{imageUrl}

### users

- POST /admin/User/createuser
- POST /admin/User/searchuser/{id}

### audit

- POST /admin/audit/logs
- GET /admin/audit/logs

### facturacion digital

- POST /admin/Facturacion/nota_credito
- POST /admin/Facturacion/nota_debito
- GET /admin/Facturacion/reporte_z

### auxiliares

- GET /Rate
- GET https://medizins.com/updateApp/checkLatestVersion

## Riesgos y Rarezas que TypeScript Debe Preservar o Corregir

- Hay endpoints GET con body.
- Hay endpoints fuera del prefijo /admin.
- Hay respuestas toleradas con multiples formas.
- El cliente depende de side effects de auditoria automatica.
- El cache local se usa como fallback funcional, no solo como optimizacion.
- Las imagenes usan otro host distinto del backend principal.