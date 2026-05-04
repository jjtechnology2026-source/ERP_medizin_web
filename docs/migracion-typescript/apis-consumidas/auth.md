## Modulo Auth

### Login de agente

Endpoint:

- GET /login_agent

DTO de entrada real:

La app envia el body JSON aun siendo GET:

```json
{
  "user": "usuario",
  "password": "clave",
  "lastLogin": "2026-04-20T10:30:00.000Z"
}
```

Notas:

- lastLogin es opcional.
- El cliente fuerza Content-Type: application/json.

JSON de salida observado y campos leidos por la app:

```json
{
  "token": "jwt",
  "refresh_token": "refresh",
  "agentId": "agent-1",
  "agentUsername": "juan.perez",
  "agentPassword": "clave-opcional",
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
  "permits": [],
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

Retorno interno:

```json
{
  "success": true,
  "token": "jwt",
  "refreshToken": "refresh",
  "message": "Login exitoso",
  "agentData": {
    "token": "jwt",
    "refresh_token": "refresh",
    "agentId": "agent-1",
    "agentUsername": "juan.perez",
    "agentPassword": "clave-opcional",
    "pharmacyName": "Sucursal Centro",
    "pharmacyId": "pharmacy-1",
    "rif": "J123456789",
    "groupId": "group-1",
    "groupName": "Grupo Medizin",
    "email": "agent@empresa.com",
    "sanitaryRegistrationNumber": "SR-123",
    "mppRegistration": "MPP-123",
    "birthDate": "1990-01-01",
    "phoneNumber": "04141234567",
    "permitsArray": [],
    "permits": [],
    "role": "admin",
    "usesDigitalBilling": true
  }
}
```

Notas de migracion:

- El endpoint hoy rompe la convencion REST al usar GET con body.
- TypeScript deberia preservar este comportamiento mientras el backend no cambie.

