# Medizin Admin Dashboard 🚀

Este proyecto es el panel administrativo de Farmacias de **Medizin**, diseñado para gestionar farmacias, productos, órdenes, grupos y usuarios con una arquitectura escalable, mantenible y un diseño premium.

## 🛠️ Stack Tecnológico

- **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/)
- **Iconos:** [React Icons](https://react-icons.github.io/react-icons/)
- **Estado Global:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Data Fetching:** [React Query (TanStack Query)](https://tanstack.com/query/latest) & [Axios](https://axios-http.com/)
- **Autenticación:** [Next-Auth (Auth.js)](https://next-auth.js.org/)

---

## 🏗️ Organización de Carpetas (Screaming Architecture)

El proyecto sigue una estructura basada en **Features**, donde cada funcionalidad principal tiene su propio ecosistema. Esto facilita la localización de lógica y la escalabilidad.

```text
/features
  /[feature-name]        # Ejemplo: farmacias, usuarios, productos
    /components          # Componentes específicos de la feature
    /hooks               # Hooks personalizados para la lógica de la feature
    /services            # Llamadas a la API específicas
    /types               # Definiciones de TypeScript y constantes
/components
  /shared                # Componentes genéricos reutilizables (DataTable, Modals)
  /ui                    # Componentes de UI base (Botones, Inputs, Sidebar)
/store                   # Stores de Zustand (Auth, Filtros Globales)
/lib                     # Configuraciones (Axios, AuthOptions)
/providers               # Wrappers de Contexto (QueryClient, NextAuth)
/hooks                   # Hooks transversales (useFetch, useNotification)
```

---

## 📋 Componente de Lista Genérico (`DataTable`)

Contamos con un sistema de tablas ultra-flexible que maneja paginación, búsqueda global y filtros automáticos.

### Uso Básico

```tsx
import { DataTable } from "@/components/shared/dataTable/dataTable";

<DataTable
  data={misDatos}
  columns={[
    { header: "Nombre", key: "nombre" },
    {
      header: "Estado",
      key: "status",
      render: (item) => <Badge>{item.status}</Badge>,
    },
  ]}
  onEdit={(item) => handleEdit(item)}
  onDelete={(item) => handleDelete(item)}
/>;
```

### Características:

- **`useDataTable` Hook:** Maneja toda la lógica interna (filtrado, búsqueda, paginación) de forma desacoplada de la UI.
- **Filtros Dinámicos:** Soporta filtrado por rangos de fecha, multiselect (arrays) y búsqueda parcial.
- **Responsive:** Se transforma automáticamente en "Cards" en dispositivos móviles para una mejor experiencia.

---

## 🔐 Sistema de Autenticación

Implementamos un sistema híbrido que combina la seguridad de **Next-Auth** con la reactividad de **Zustand**.

1.  **Next-Auth (`lib/auth.ts`):** Gestiona el ciclo de vida de la sesión, el refresco automático del Token (Rotation) y la persistencia en cookies seguras.
2.  **Zustand Auth Store (`store/useAuthStore.ts`):** Sincroniza los datos del perfil del usuario para acceso inmediato en cualquier componente sin necesidad de esperar al hook `useSession`.
3.  **AuthSync (`components/auth/AuthSync.tsx`):** Un componente "invisible" que mantiene ambos estados sincronizados.

---

## 📡 Data Fetching & API

### Axios (`lib/axios.ts`)

Configurado con interceptores para:

- Inyectar el `Authorization: Bearer <token>` automáticamente.
- Manejar errores `401` de forma global (logout automático si la sesión expira).
- Limpieza de caracteres invisibles en tokens.

### React Query

Utilizamos `QueryProvider` para gestionar el caché de las peticiones, con una configuración robusta:

- `staleTime`: 1 minuto (por defecto).
- Reintentos automáticos limitados.
- Manejo de errores centralizado en mutaciones y queries.
