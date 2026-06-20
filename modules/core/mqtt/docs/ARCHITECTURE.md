# Arquitectura del Motor MQTT - Medizin ERP

Este documento describe los componentes del motor MQTT ubicado en `modules/core/mqtt` y cómo colaboran para habilitar funcionalidades en tiempo real en todo el sistema.

## Componentes Principales

### 1. `client.ts` (Cliente Base)
Es la capa más baja. Define la configuración básica de conexión y envoltorios (wrappers) simples sobre la librería `mqtt.js`. Su objetivo es proporcionar una interfaz limpia para conectar, desconectar y emitir eventos básicos de red.

### 2. `advanced-service.ts` (El Motor/Singleton)
Es el "corazón" del sistema MQTT. Implementa un patrón Singleton (`MqttServerService`) que asegura una única conexión activa en toda la aplicación.
- **Resiliencia**: Maneja reconexión automática con backoff exponencial.
- **Protocol Buffers**: Centraliza la lógica de decodificación binaria de los mensajes entrantes.
- **Gestión de Suscripciones**: Mantiene un registro de tópicos activos para re-suscribirse automáticamente tras una desconexión.
- **Middleware de Mensajes**: Filtra y enruta los mensajes según el tópico antes de entregarlos a los componentes interesados.

### 3. `topics.ts` (Diccionario de Tópicos)
Centraliza todas las cadenas de tópicos utilizadas en el sistema. 
- Evita errores de escritura ("typos").
- Permite cambios globales en la estructura de tópicos desde un solo lugar.
- Soporta tópicos dinámicos mediante funciones (ej. `marketplacePharmacy(pharmacyId)`).

### 4. `types.ts` (Contratos de Datos)
Define las interfaces TypeScript para las configuraciones, estados de conexión y estructuras de datos comunes que viajan por el bus de mensajes. Garantiza que el tipado sea consistente entre el emisor y el receptor.

### 5. `index.ts` (Punto de Entrada)
Exporta los componentes públicos del motor para que otros módulos (como Marketplace o Inventario) puedan consumirlos de forma limpia:
```typescript
import { mqttServer, MQTT_TOPICS } from "@/modules/core/mqtt";
```

## Flujo de Trabajo (Ejemplo: Órdenes Marketplace)

1.  **Inicialización**: El `MqttOrdersProvider` (en Marketplace) solicita al `mqttServer` suscribirse a los tópicos de la farmacia.
2.  **Escucha Activa**: El `mqttServer` recibe un paquete binario desde el broker EMQX.
3.  **Procesamiento**:
    - `mqttServer` identifica el tópico usando `topics.ts`.
    - Utiliza las interfaces generadas por Protobuf para decodificar el payload.
    - Notifica a los "handlers" registrados.
4.  **Consumo**: El `MqttOrdersProvider` recibe los datos normalizados, actualiza la cola de órdenes y dispara las notificaciones visuales (Modales/Badges).
5.  **Respuesta**: Cuando el usuario acepta una orden, se llama a `mqttServer.publish()` usando un tópico de respuesta definido en `topics.ts`.

## Futuras Extensiones
Este motor está diseñado para ser agnóstico al dominio. Para añadir nuevas funcionalidades (ej. alertas de stock, actualizaciones de inventario entre sucursales), simplemente:
1.  Añadir los nuevos tópicos en `topics.ts`.
2.  Definir los DTOs en Protobuf si es comunicación binaria.
3.  Crear un nuevo Provider o Hook en el módulo correspondiente que consuma el `mqttServer`.
