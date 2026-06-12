# Sistema de Gestión de Órdenes en Tiempo Real (MQTT) - Marketplace

Este módulo se encarga de la recepción, procesamiento y gestión de órdenes provenientes del Marketplace en tiempo real utilizando el protocolo MQTT.

## Arquitectura

El sistema se divide en tres capas principales:

1.  **Capa de Transporte (`core/mqtt`)**: Gestiona la conexión persistente con el broker EMQX, re-suscripciones automáticas y el manejo de paquetes binarios (Protocol Buffers).
2.  **Capa de Estado (`marketplace/providers`)**: El `MqttOrdersProvider` mantiene la cola de órdenes pendientes, el estado de la conexión y las acciones del usuario (Aceptar/Rechazar).
3.  **Capa de Interfaz (`marketplace/components`)**: Componentes reactivos que reaccionan a los cambios de estado (Modales globales, badges en tablas).

## Flujo de Trabajo de una Orden

1.  **Recepción**: El cliente MQTT escucha en el tópico `pharmacy/{pharmacyId}`.
2.  **Decodificación**: Los mensajes llegan como `Uint8Array` (binario). Se intentan decodificar usando dos formatos:
    *   `OrderContactAndItems`: Formato legado para compatibilidad.
    *   `OrderDto`: Formato estándar basado en Protobuf.
3.  **Normalización**: Los datos decodificados se convierten a una estructura única `MarketplaceOrderSummary`.
4.  **Notificación**: Se añade la orden a la cola global y se activa el modal de "Nueva Orden" si no hay una siendo atendida.
5.  **Acción**: El administrador puede Aceptar o Rechazar. Esto publica un mensaje en los tópicos correspondientes:
    *   Aceptar: `pharmacy/{pharmacyId}/orden_id/{orderId}/accept_order`
    *   Rechazar: `pharmacy/{pharmacyId}/orden_id/{orderId}/negada_order`

## Robustez y Resiliencia

-   **Persistencia Local**: La cola de órdenes se mantiene en memoria mientras la pestaña está abierta.
-   **Auto-reconexión**: Si la conexión se pierde, el servicio core reintenta con backoff exponencial.
-   **Validación de Datos**: Se realizan múltiples intentos de parseo (JSON, Binario) para asegurar que ninguna orden se pierda por errores de formato.
-   **Feedback Global**: Los diálogos de confirmación aseguran que el usuario sepa si su acción se publicó correctamente en el broker.

## Consideraciones Técnicas

-   **Protobuf**: Es obligatorio mantener sincronizadas las interfaces en `proto/interfaces/present.ts` con las definiciones del broker.
-   **Globalidad**: El `GlobalOrderNotifications` debe estar envuelto en el nivel más alto de los providers para garantizar visibilidad en cualquier ruta.
