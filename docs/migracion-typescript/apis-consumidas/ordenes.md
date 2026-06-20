## Modulo Orders

### Insertar ordenes sincronizadas

Endpoint:

- POST /admin/Orders/insertorder

DTO de entrada real:

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
      },
      {
        "runtimeType": "Dollars",
        "type": "dollars",
        "change": 1,
        "amount": 10
      },
      {
        "runtimeType": "Card",
        "type": "card",
        "punto": "BNC-01",
        "cardType": "debit",
        "reference": "ABC123",
        "amount": 7
      },
      {
        "runtimeType": "Mobile",
        "type": "mobile",
        "amount": 7,
        "reference": "MOB123",
        "bank": "0102"
      },
      {
        "runtimeType": "Biopago",
        "type": "biopago",
        "amount": 7,
        "reference": "BIO123",
        "bank": "0102"
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

Notas del request:

- Si clientId viene vacio, el servicio envia id y documento como 0000000000.
- Si clientName viene vacio, envia Cliente General.
- Si address viene vacio, envia N/A.
- Si clientPhone comienza con +58, lo recorta antes de enviar.
- sale_type se serializa como Local, delivery o pickup.
- numero_control sale de numeroControlInterno si existe; si no, de facturacion.numeroControl.

JSON de salida tolerado para insertOrderWithDetails:

- 200 o 201 para exito.
- En insertOrderWithDetails el cliente intenta extraer la orden persistida desde:
  - una lista en la raiz,
  - un objeto data con lista,
  - o un objeto equivalente a la orden.

Estructura completa de orden que el parser puede absorber desde SearchOrders o desde la orden persistida devuelta por el insert:

```json
{
  "date": "2026-04-20T10:30:00.000Z",
  "id": "01H...",
  "idOrder": "01H...",
  "nameGroup": "Grupo Medizin",
  "idAgent": "agent-1",
  "nameAgent": "juan.perez",
  "idPharmacy": "pharmacy-1",
  "idGroup": "group-1",
  "medications": [
    {
      "brand": "Genfar",
      "activeIngredient": "Acetaminofen",
      "dosage": "500mg",
      "tablets": "10 tabletas",
      "barCode": "7591234567890",
      "name": "Acetaminofen",
      "image": "acetaminofen.webp",
      "category": "Analgesicos",
      "subcategory": "Tabletas",
      "price": 3.5,
      "quantity": 2,
      "stock": 18,
      "description": "Caja de 10 tabletas",
      "controlled": false,
      "vat": 16,
      "antibiotic": false,
      "minimum": 5
    }
  ],
  "totalreal": 7,
  "totalsystem": 7,
  "client": {
    "id": "V12345678",
    "name": "Juan Perez",
    "email": "juan@correo.com",
    "direccion": "Caracas",
    "phone": "04141234567",
    "documento": "V12345678"
  },
  "clientName": "Juan",
  "clientLastName": "Perez",
  "clientId": "V12345678",
  "clientEmail": "juan@correo.com",
  "clientPhone": "04141234567",
  "payments": [
    {
      "runtimeType": "Cash",
      "change": 0,
      "amount": 7
    }
  ],
  "rate": 36.5,
  "rifEmisor": "J123456789",
  "rif_emisor": "J123456789",
  "gender": "Male",
  "saleStatus": "Completed",
  "sale_status": "Completed",
  "isControlled": false,
  "saleType": "local",
  "sale_type": "Local",
  "address": "Caracas",
  "pharmacy": "Sucursal Centro",
  "synced": true,
  "numero_control_interno": "INT-1",
  "numeroControlInterno": "INT-1",
  "numero_control": "A000123",
  "facturacion": {
    "success": true,
    "numero_control": "A000123",
    "resp": {
      "numerointerno": "INT-1",
      "numerocontrol": "A000123",
      "trackingid": "TRACK-1",
      "urlpdf": "https://.../factura.pdf",
      "fecha": "2026-04-20"
    },
    "error": null
  },
  "observation": "Texto opcional"
}
```

Retorno interno:

- insertOrders: bool
- insertOrderWithDetails: objeto con success, statusCode, message, details y order opcional

### Insertar ordenes fiscales locales

Endpoint:

- POST /admin/Orders/orders/local

DTO de entrada real:

- Mismo contrato de insertorder.
- Adicionalmente incluye numero_control_interno.

```json
[
  {
    "date": "2026-04-20T10:30:00.000Z",
    "id": "01H...",
    "nameGroup": "Grupo Medizin",
    "idAgent": "agent-1",
    "nameAgent": "juan.perez",
    "idPharmacy": "pharmacy-1",
    "idGroup": "group-1",
    "medications": [],
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
    "payments": [],
    "numero_control": "A000123",
    "numero_control_interno": "A000123",
    "facturacion": {
      "success": true,
      "numero_control": "A000123",
      "resp": {
        "numerointerno": "INT-1",
        "numerocontrol": "A000123",
        "trackingid": "TRACK-1",
        "urlpdf": "https://.../factura.pdf",
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

JSON de salida:

- 200 o 201.
- Si se usa insertLocalOrderWithDetails, aplica el mismo extractor tolerante documentado arriba.

Uso:

- Persistir ordenes procesadas por flujo fiscal local.

### Health de ordenes

Endpoint:

- GET /admin/Orders/health

DTO de entrada:

- Sin body.

JSON de salida:

- 200 si el servicio esta disponible.

Retorno interno:

- bool

### Obtener ordenes del agente

Endpoint:

- GET /admin/Orders/get

DTO de entrada:

- Sin body.

JSON de salida exacto que Order.fromJson puede parsear sin normalizacion previa:

```json
[
  {
    "date": "2026-04-20T10:30:00.000Z",
    "idOrder": "01H...",
    "nameGroup": "Grupo Medizin",
    "idAgent": "agent-1",
    "nameAgent": "juan.perez",
    "idPharmacy": "pharmacy-1",
    "idGroup": "group-1",
    "medications": [
      {
        "brand": "Genfar",
        "activeIngredient": "Acetaminofen",
        "dosage": "500mg",
        "tablets": "10 tabletas",
        "barCode": "7591234567890",
        "name": "Acetaminofen",
        "image": "acetaminofen.webp",
        "category": "Analgesicos",
        "subcategory": "Tabletas",
        "price": 3.5,
        "quantity": 2,
        "stock": 18,
        "description": "Caja de 10 tabletas",
        "controlled": false,
        "vat": 16,
        "antibiotic": false,
        "minimum": 5
      }
    ],
    "totalreal": 7,
    "totalsystem": 7,
    "clientName": "Juan",
    "clientLastName": "Perez",
    "clientId": "V12345678",
    "clientEmail": "juan@correo.com",
    "clientPhone": "04141234567",
    "payments": [
      {
        "runtimeType": "Cash",
        "change": 0,
        "amount": 7
      }
    ],
    "rate": 36.5,
    "rifEmisor": "J123456789",
    "gender": "Male",
    "saleStatus": "Completed",
    "isControlled": false,
    "saleType": "local",
    "address": "Caracas",
    "pharmacy": "Sucursal Centro",
    "synced": true,
    "numero_control_interno": "INT-1",
    "facturacion": {
      "success": true,
      "numero_control": "A000123",
      "resp": {
        "numerointerno": "INT-1",
        "numerocontrol": "A000123",
        "trackingid": "TRACK-1",
        "urlpdf": "https://.../factura.pdf",
        "fecha": "2026-04-20"
      },
      "error": null
    },
    "observation": "Texto opcional"
  }
]
```

Retorno interno:

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

JSON de salida tolerado:

- Lista JSON de ordenes.

Aliases soportados por el normalizador:

- id o idOrder
- sale_type o saleType
- sale_status o saleStatus
- rif_emisor o rifEmisor
- numero_control_interno, numeroControlInterno o numero_control
- client anidado con id, documento, name, email, phone y direccion

Retorno interno:

- List<Order> o null







