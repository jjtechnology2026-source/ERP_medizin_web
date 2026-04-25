# Paquete de Migracion a TypeScript

## Contenido

- [plan-migracion-typescript.md](plan-migracion-typescript.md)
- [tipos-iniciales.ts](tipos-iniciales.ts)
- [matriz-modulos-flutter-a-typescript.md](matriz-modulos-flutter-a-typescript.md)
- [mqtt-flujos.md](mqtt-flujos.md)
- [apis-consumidas.md](apis-consumidas.md)
- [modulos-construccion-y-modelos.md](modulos-construccion-y-modelos.md)

## Orden de Lectura Recomendado

1. [plan-migracion-typescript.md](plan-migracion-typescript.md)
2. [modulos-construccion-y-modelos.md](modulos-construccion-y-modelos.md)
3. [apis-consumidas.md](apis-consumidas.md)
4. [mqtt-flujos.md](mqtt-flujos.md)
5. [matriz-modulos-flutter-a-typescript.md](matriz-modulos-flutter-a-typescript.md)
6. [tipos-iniciales.ts](tipos-iniciales.ts)

## Uso Sugerido para Otra IA

- Leer primero el plan para entender el orden de trabajo.
- Tomar los contratos HTTP y MQTT como fuente inicial de integraciones.
- Usar [tipos-iniciales.ts](tipos-iniciales.ts) como semilla de modelos y DTOs.
- Usar la matriz de modulos para estructurar el nuevo workspace TypeScript.

## Observacion Importante

El punto de mayor riesgo de la migracion no es la UI: es la integracion fiscal local y la mezcla actual de offline, JSON local, MQTT y side effects distribuidos en providers.