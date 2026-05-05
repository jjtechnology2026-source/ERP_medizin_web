# 🚀 Próximos Pasos: Documentación y Refactorización

Este documento sirve como guía para las tareas pendientes de documentación técnica y optimización de componentes en el proyecto.

---

## 1. 📖 Documentación por Módulos
Es necesario documentar la responsabilidad y estructura de cada módulo dentro de `modules/`.

- [ ] **Auth**: Flujo de autenticación con NextAuth y persistencia en Zustand.
- [ ] **Orders**: Gestión de pedidos, filtros y modales de detalle.
- [ ] **Products/Inventory**: Administración de stock, creación manual y búsqueda en catálogo.
- [ ] **Marketplace**: Integración con MQTT para notificaciones en tiempo real y flujo de pedidos externos.
- [ ] **Core**: Documentar la infraestructura compartida (API client, hooks globales, providers).
- [ ] **Settings**: Configuración administrativa (Fiscal, Auditoría).

---

## 2. 🏗️ Estructura de Tipos (Types)
Documentar dónde residen los tipos y cómo se relacionan.

- [ ] **Proto DTOs**: Documentar `proto/interfaces/dto.ts` y `present.ts` como la fuente de verdad para objetos de dominio (Order, Medicine, etc.).
- [ ] **Module Types**: Tipos específicos de UI en `modules/[module]/types/`.
- [ ] **Zustand Stores**: Documentar los esquemas de estado (e.g., `UserProfile` en `useAuthStore.ts`).

---

## 3. 📡 Comunicación entre Módulos
Explicar los patrones de comunicación utilizados:

- [ ] **API Client**: Uso de `modules/core/api/client.ts` con interceptores para manejo de tokens y refresco de sesión.
- [ ] **State Management**: Uso de Zustand para estado global persistente (Auth, etc.).
- [ ] **Real-time**: Flujo de datos vía MQTT en el módulo Marketplace.
- [ ] **Hooks/Services**: Patrón de separación entre UI (componentes) y lógica/datos (hooks y services).

---

## 4. 🧩 Creación de Componente de Lista Genérica
Para reducir la duplicación de código y estandarizar la UI, se debe crear un componente genérico para las tablas/listas.

### Objetivo:
Reemplazar la lógica repetitiva en `OrderListTable.tsx` y `TabInventory.tsx` con un componente base.

### Tareas:
- [ ] **Definir Interfaz**: Crear una interfaz genérica que acepte `data`, `columns`, `paginationConfig` y `actions`.
- [ ] **Componente `GenericTable`**: 
    - Implementar el diseño de "Tarjeta Blanca" con bordes redondeados (`rounded-[40px]`).
    - Integrar la UI de paginación estandarizada.
    - Manejar estados de `loading` y "No hay datos" con mensajes personalizables.
- [ ] **Implementar en Módulos**:
    - [ ] Refactorizar `modules/orders/components/OrderListTable.tsx`.
    - [ ] Refactorizar `modules/products/components/TabInventory.tsx`.

---

## 📝 Documentación General
- [ ] Actualizar el `README.md` principal con una visión general de la arquitectura.
- [ ] Crear guías de estilo para nuevos componentes (Tailwind + Framer Motion si aplica).
- [ ] Documentar el proceso de despliegue y variables de entorno necesarias.

---

> [!TIP]
> Al crear el componente genérico, asegúrate de mantener las micro-animaciones (`animate-in fade-in`) y el diseño premium (sombras sutiles, fuentes `font-black` para énfasis).
