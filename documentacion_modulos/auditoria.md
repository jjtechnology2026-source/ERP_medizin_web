# Auditoría

Documento técnico breve que describe exclusivamente la estructura y funcionamiento del módulo de auditoría en `modules/audit`.

Propósito

- Mostrar y filtrar logs de auditoría del sistema.
- Normalizar la información de eventos para trazabilidad.

Estructura jerárquica y responsabilidades (concretas)

- `index.tsx`:
  - Punto de entrada del módulo. Orquesta la UI: mantiene estado de `filtros`, `página` y `limit`, invoca fetches y pasa datos a los componentes de presentación.

- `types.ts`:
  - Define las interfaces TypeScript usadas por el módulo: `AuditLogEntry`, `AuditLogFilters` y tipos relacionados. Es la fuente de verdad para contratos internos.

- `components/`:
  - `AuditEntryCard.tsx`: Componente presentacional que recibe un `AuditLogEntry` y lo muestra (usuario, acción, entidad, timestamp, old/new values, IP, user agent).
  - `AuditFilters.tsx`: Componente de filtros que emite un `AuditLogFilters` (acción, entidad, id, usuario, rango de fechas, etc.). Solo emite callbacks; no realiza fetches.

- `services/audit.ts`:
  - Utilidades puras del módulo:
    - `buildParams(filters, page, limit)`: convierte `AuditLogFilters` a los parámetros que acepta la API (ej.: `entity_name`, `start_date`, `offset`, `limit`).
    - `normalizeAuditEntry(apiEntry)`: mapea respuestas de la API (snake_case o camelCase) a `AuditLogEntry` consistente.
  - Debe ser la única capa que conozca diferencias de naming entre API y frontend.

Flujo de funcionamiento (resumido)

1. El usuario ajusta filtros en `AuditFilters`.
2. `index.tsx` recibe los filtros y calcula `params = AuditService.buildParams(filters, page, limit)`.
3. `index.tsx` hace la petición HTTP (usualmente a través del cliente `api` central o React Query) pasando `params`.
4. La respuesta se normaliza con `AuditService.normalizeAuditEntry` y se pasa a `AuditEntryCard` para render.

Notas finales (estrictamente relevantes)

- Mantener los contratos en `types.ts` sincronizados con la API.
- Evitar lógica de transformación en componentes; usar `services/audit.ts` para centralizar mapeos.
- `index.tsx` funciona como controlador/parent: no debe contener lógica de normalización, solo orquestación y manejo de estado.
- `AuditFilters` es un componente controlado: no debe hacer fetches, solo emitir cambios de filtros al padre.

**Ejemplos y fragmentos útiles**

- `types.ts` (ejemplo minimal):

```ts
export interface AuditLogEntry {
  id: string;
  action: string;
  entityName?: string;
  entityId?: string;
  userId?: string;
  timestamp?: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  ipAddress?: string;
  actorName?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  action?: string;
  entityName?: string;
  entityId?: string;
  userId?: string;
  startDate?: string; // ISO
  endDate?: string; // ISO
}
```

Explicación: este bloque define los tipos mínimos que el módulo espera recibir y manipular. Úsalo como contrato fuente de verdad en `types.ts`; los servicios y componentes deben ajustarse a estas formas para evitar errores de mapeo.

- `services/audit.ts` (uso práctico de `buildParams` y `normalizeAuditEntry`):

```ts
import { AuditService } from "./services/audit";

const filters = {
  action: "UPDATE",
  entityName: "Order",
  startDate: "2026-05-01",
};
const page = 1;
const limit = 50;

// Construir params que acepta la API
const params = AuditService.buildParams(filters, page, limit);
// Ejemplo resultante: { action: 'UPDATE', entity_name: 'Order', start_date: '2026-05-01T00:00:00.000Z', offset: 0, limit: 50 }

// Tras recibir respuesta del backend:
const apiEntry = {
  id: "123",
  action: "UPDATE",
  entity_name: "Order",
  entity_id: "ord_1",
  user_id: "user_1",
  timestamp: "2026-05-05T12:00:00Z",
  old_values: { status: "PENDING" },
  new_values: { status: "COMPLETED" },
  ip_address: "192.168.0.1",
  actor_name: "Admin Test",
};

const normalized = AuditService.normalizeAuditEntry(apiEntry);
// normalized ahora cumple `AuditLogEntry` y puede pasarse a la UI
```

Explicación: este ejemplo muestra el flujo típico: construir parámetros con `buildParams`, recibir una entrada del backend y normalizarla con `normalizeAuditEntry`. Sirve para verificar que tus transformaciones cubren casos tanto en snake_case como en camelCase.

- Ejemplo de integración en `index.tsx` usando React Query (concretado):

```tsx
import { useQuery } from "@tanstack/react-query";
import api from "@/modules/core/api/client";
import { AuditService } from "./services/audit";

const params = AuditService.buildParams(filters, page, limit);

const { data, isLoading } = useQuery(["audit-logs", params], async () => {
  const res = await api.get("/admin/audit/logs", { params });
  const list = res.data?.result || res.data?.data || res.data || [];
  return list.map(AuditService.normalizeAuditEntry);
});

// Luego renderizas:
// {data.map(entry => <AuditEntryCard key={entry.id} {...entry} />)}
```

Explicación: este snippet muestra cómo integrar la normalización dentro de una query de React Query. Verifica que `params` coincide con las claves de tu mock/backend y que `AuditEntryCard` acepta el `AuditLogEntry` resultante.

- Ejemplo de mock para `docs/mocks.ts` (clave a añadir si usas modo test):

```ts
"/admin/audit/logs": [
  {
    id: '123',
    action: 'UPDATE',
    entity_name: 'Order',
    entity_id: 'ord_1',
    user_id: 'user_1',
    timestamp: '2026-05-05T12:00:00Z',
    old_values: { status: 'PENDING' },
    new_values: { status: 'COMPLETED' },
    ip_address: '192.168.0.1',
    actor_name: 'Admin Test',
  }
]
```

Explicación: ejemplo de mock para desarrollo local. Añádelo a `docs/mocks.ts` si usas `NEXT_PUBLIC_TEST_MODE=true`. Permite probar la UI sin backend y validar los mapeos definidos en `normalizeAuditEntry`.

Con este mock, cuando `process.env.NEXT_PUBLIC_TEST_MODE === "true"` y el código pide `/admin/audit/logs` sin parámetros adicionales (o si tu `useApi` soporta prefijos), se devolverán entradas de auditoría para probar la UI localmente.
