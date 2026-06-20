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

JSON de salida tolerado por AuditLogPage.fromResponse:

La app tolera multiples formatos. Puede parsear:

```json
{
  "items": [
    {
      "id": "log-1",
      "log_id": "log-1",
      "action": "CREATE",
      "entity_name": "user",
      "entityName": "user",
      "entity_id": "user:V12345678",
      "entityId": "user:V12345678",
      "user_id": "juan.perez",
      "userId": "juan.perez",
      "timestamp": "2026-04-20T10:30:00.000Z",
      "created_at": "2026-04-20T10:30:00.000Z",
      "createdAt": "2026-04-20T10:30:00.000Z",
      "old_values": null,
      "oldValues": null,
      "new_values": {
        "id": "V12345678",
        "name": "Juan Perez",
        "email": "juan@correo.com",
        "direccion": "Caracas",
        "documento": "V12345678",
        "phone": "04141234567"
      },
      "newValues": {
        "id": "V12345678",
        "name": "Juan Perez",
        "email": "juan@correo.com",
        "direccion": "Caracas",
        "documento": "V12345678",
        "phone": "04141234567"
      },
      "ip_address": "127.0.0.1",
      "ipAddress": "127.0.0.1",
      "user_name": "juan.perez",
      "userName": "juan.perez",
      "username": "juan.perez",
      "agent_name": "juan.perez",
      "agentName": "juan.perez",
      "agent_username": "juan.perez",
      "agentUsername": "juan.perez",
      "user_agent": "Inventario Medizin",
      "userAgent": "Inventario Medizin"
    }
  ],
  "rows": [],
  "results": [],
  "logs": [],
  "data": [],
  "total": 1,
  "count": 1,
  "limit": 50,
  "page_size": 50,
  "pageSize": 50,
  "offset": 0
}
```

o variantes dentro de data, result o payload.

Retorno interno:

```json
{
  "items": [
    {
      "id": "log-1",
      "action": "CREATE",
      "entityName": "user",
      "entityId": "user:V12345678",
      "userId": "juan.perez",
      "timestamp": "2026-04-20T10:30:00.000Z",
      "oldValues": null,
      "newValues": {
        "id": "V12345678",
        "name": "Juan Perez",
        "email": "juan@correo.com",
        "direccion": "Caracas",
        "documento": "V12345678",
        "phone": "04141234567"
      },
      "ipAddress": "127.0.0.1",
      "actorName": "juan.perez",
      "userAgent": "Inventario Medizin"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```
