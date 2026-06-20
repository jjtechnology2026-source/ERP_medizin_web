## Modulo User

### Crear usuario

Endpoint:

- POST /admin/User/createuser

DTO de entrada real:

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

JSON de salida:

- 200 o 201 para exito.

Que hace adicionalmente la app:

- Si sale bien, guarda usuario local con synced true.
- Si falla, lo guarda con synced false para sincronizar luego.

Retorno interno:

- bool

### Buscar usuario por id

Endpoint:

- POST /admin/User/searchuser/{id}

DTO de entrada:

- Sin body util.

JSON de salida exacto parseado como UserModel:

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

Retorno interno:

```json
{
  "user": {
    "id": "V12345678",
    "name": "Juan Perez",
    "email": "juan@correo.com",
    "direccion": "Caracas",
    "documento": "V12345678",
    "phone": "04141234567"
  },
  "fromCache": false
}
```

### Reintento de usuarios no sincronizados

Endpoint usado internamente:

- POST /admin/User/createuser

DTO de entrada:

- Los mismos datos de UserModel tomados del cache local.

JSON de salida:

- 200 o 201 para marcar synced true.

## Modulo Audit

### Crear log de auditoria

Endpoint:

- POST /admin/audit/logs

DTO de entrada real:

```json
{
  "action": "CREATE",
  "entity_name": "user",
  "entity_id": "user:V12345678",
  "old_values": null,
  "new_values": {
    "id": "V12345678",
    "name": "Juan Perez",
    "email": "juan@correo.com",
    "direccion": "Caracas",
    "documento": "V12345678",
    "phone": "04141234567"
  },
  "user_name": "juan.perez",
  "userName": "juan.perez",
  "agent_username": "juan.perez",
  "agentUsername": "juan.perez",
  "user_agent": "Inventario Medizin"
}
```

Notas:

- action se normaliza a uppercase.
- entity_id se construye con prefijo entity_name:id si rawId no trae dos puntos.
- El header User-Agent tambien se envia si userAgent viene informado.

JSON de salida:

- 200 o 201.

Retorno interno:

- bool

Observacion:

- El DioClient tambien envia auditoria automatica para muchas operaciones de escritura usando este mismo endpoint.
