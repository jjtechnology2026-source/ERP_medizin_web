# MQTT Logging System (Server-Only Logs)

Este módulo implementa un sistema de logs híbrido que garantiza la **privacidad total** en el navegador del usuario final, redirigiendo toda la información técnica y de depuración directamente a la terminal del servidor (IDE).

## El Problema
Por defecto, los logs de consola en una aplicación Next.js se ejecutan en el navegador si el código es parte de un Client Component. Esto expone:
1.  **Datos Sensibles**: Payloads de mensajes MQTT, tokens o IDs internos.
2.  **Ruido Técnico**: Información de conexión que el usuario final no necesita ver.
3.  **Mala Estética**: Una consola llena de logs resta profesionalismo a la aplicación.

## La Solución: Logs en Terminal mediante Server Actions

Hemos implementado una arquitectura de redirección de logs que funciona en tres pasos:

### 1. La Server Action (`server-logger.actions.ts`)
Creamos una función con la directiva `"use server"`. Esta función, aunque se llame desde el cliente, se ejecuta **exclusivamente en el servidor**.

```typescript
"use server";
export async function logToServer(level: 'log' | 'warn' | 'error', message: string, data?: any) {
  // Este código corre en el servidor (tu terminal/IDE)
  console[level](`[CLIENT-LOG] ${message}`, data || "");
}
```

### 2. Detección de Entorno (`isServer`)
En el servicio MQTT (`advanced-service.ts`), detectamos si estamos en el servidor o en el navegador:

```typescript
const isServer = typeof window === "undefined";
```

### 3. El Método Logger Centralizado
En lugar de usar `console.log` directamente, el servicio utiliza un método privado `log()` que decide qué hacer:

```typescript
private log(level: "log" | "warn" | "error", msg: string, ...args: any[]) {
  const isServer = typeof window === "undefined";

  if (isServer) {
    // Si es el servidor real, usamos la consola normal
    console[level](msg, ...args);
  } else {
    // Si es el cliente, LLAMAMOS a la Server Action para redirigir el log
    // y NO escribimos nada en la consola del navegador.
    if (msg.includes("[MQTT:CONNECT]") || msg.includes("[MQTT:SUB]")) {
      logToServer(level, msg, args.length > 0 ? args : undefined);
    }
  }
}
```

## Cómo Replicarlo en Futuros Módulos

Para implementar este comportamiento en otros servicios:

1.  **Importa la acción**: `import { logToServer } from "./server-logger.actions";`.
2.  **Evita `console.log` directo**: No uses la consola global directamente en lógica de negocio del cliente.
3.  **Usa un Helper**: Implementa una función de utilidad o método privado que verifique `typeof window`.
4.  **Filtra**: Solo redirige logs que sean útiles para depuración técnica. Logs de UI (como "Botón clickeado") usualmente no necesitan ir al servidor.

## Ventajas
-   **Seguridad**: El usuario nunca ve la estructura de tus mensajes MQTT.
-   **Limpieza**: La consola del navegador se mantiene 100% limpia para errores reales de UI.
-   **Centralización**: Todos los logs de todos los clientes conectados (en desarrollo) aparecen en tu terminal del IDE.

---
*Medizin ERP - Engineering Team*
