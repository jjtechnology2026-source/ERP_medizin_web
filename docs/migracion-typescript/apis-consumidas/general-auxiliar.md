## Modulo General y Auxiliar

### Tasa de cambio

Endpoint:

- GET /Rate

DTO de entrada real:

Aunque es GET, la app envia data:

```json
{
  "Moneda": "USD",
  "Fechavalor": "2026-04-20"
}
```

JSON de salida esperado:

```json
{
  "tipocambio": 36.5
}
```

Retorno interno:

- Stream<double>

Observacion:

- Hace polling cada 1 minuto.

### Feed de actualizacion de app

Endpoint:

- GET https://medizins.com/updateApp/checkLatestVersion

Respuesta XML esperada:

```xml
<rss>
  <channel>
    <item>
      <description>Nueva actualizacion disponible</description>
      <enclosure sparkle:version="1.2.3" url="https://medizins.com/updateApp/inventario_medizin.exe" />
    </item>
  </channel>
</rss>
```

Campos realmente usados por la app:

- item
- description
- enclosure@sparkle:version
- enclosure@url

Retorno interno cuando hay actualizacion:

```json
{
  "version": "1.2.3",
  "url": "https://medizins.com/updateApp/inventario_medizin.exe",
  "notes": "Nueva actualizacion disponible"
}
```
