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

### DTO reutilizados

#### Medicine

```json
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
```

#### FacturaResponse

```json
{
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
}
```

#### Payment variantes soportadas

```json
[
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
]
```

Notas:

- En JSON interno generado por freezed, Payment.card usa la clave type para el tipo de tarjeta. En el payload HTTP de ordenes, el servicio la renombra a cardType y agrega type: card para el tipo de pago.
- El parser de Payment usa runtimeType para discriminar la variante.

### Refresh token

Endpoint:

- POST /auth/refresh-token

DTO de entrada real:

```json
{
  "token": "refresh-token"
}
```

JSON de salida aceptado por el parser:

```json
{
  "token": "nuevo-access-token",
  "accessToken": "nuevo-access-token",
  "access_token": "nuevo-access-token",
  "refreshToken": "nuevo-refresh-token",
  "refresh_token": "nuevo-refresh-token"
}
```

Tambien acepta la misma estructura dentro de data:

```json
{
  "data": {
    "token": "nuevo-access-token",
    "refreshToken": "nuevo-refresh-token"
  }
}
```

Uso:

- Renovar sesion sin relogin.

