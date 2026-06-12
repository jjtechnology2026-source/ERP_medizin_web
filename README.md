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
- **Gráficos:** [Recharts](https://recharts.org/)

---

## Cambios y Mejoras Recientes

### 1. Inventario - Carga Inmediata (sin "No hay productos")

**Problema**: Al navegar a Productos, mostraba "No hay productos en inventario" aunque el login ya tuviera datos. El API `/admin/Inventory/Stock` devolvía 404.

**Solución**: 
- `fetchInventory` siembra el inventario **instantáneamente** desde `medicinesCatalog` (datos del login) antes de cualquier API.
- Llamada API es **best-effort** (como en Dart, que usa MQTT + estado local).
- Auto-suscripción al auth store para actualizar cuando `medicinesCatalog` cambia.
- **Skeleton loader** en vez de spinner, y NUNCA se muestra "no hay productos" durante la carga.

### 2. Catálogo de Productos - API 404 Corregido

**Problema**: `/Medications/list` devolvía 400 porque se enviaba `null` JS vs el string `"null"` que espera el backend.

**Solución**: Cambiado a `api.post("/Medications/list", "null", { headers: { "Content-Type": "application/json" } })`.

### 3. Búsqueda en Catálogo (Agregar a stock)

- **Debounce 200ms**: el filtrado pesado solo se ejecuta tras dejar de escribir.
- **Búsqueda en 3 fuentes**: API, login catalog, e inventario local.
- **Autocomplete dropdown**: 4 sugerencias inmediatas mientras escribes.
- **Tabla completa**: Nombre, PA, Dosis, Presentación, Marca, Precio, Stock.
- **Paginación**: 10 resultados/página con controles numéricos.
- **Filtros**: por marca, dosis, estado de stock (con/sin).

### 4. Formulario Precio/IVA/Stock unificado

Precio, IVA y Stock ahora están en **un solo tab**. "Detalles" se mantiene aparte. El indicador "Stock Bajo" solo aparece para productos con stock > 0.

### 5. Guardado de Producto (local-first)

En Dart el guardado es vía MQTT (no REST). Ahora el web guarda **local primero** (siempre funciona), la API es best-effort.

### 6. Imágenes rotas (.webp 404)

Función `cleanImg()` que solo renderiza imágenes con URL completa (`http://` o `data:`). Las imágenes inválidas se ocultan sin generar errores 404.

### 7. Panel de Control con datos reales

- **Tendencias reales**: crecimiento mes a mes (no "0.00%" fijo).
- **Gráfico de área** Recharts con evolución de ventas.
- Cards de estadísticas con indicadores dinámicos.

### 8. Órdenes Marketplace - Auto-refresh

Refetch automático cada **30 segundos** + al reconectar MQTT. Ya no hay que recargar manualmente.

### 9. Caja de Ventas mejorada

- Indicador de **turno activo** con ID, hora y cajero.
- Panel de **documentos del turno** (facturas, notas, artículos, transacciones).
- Tabla de orden interactiva (+/- cantidad, eliminar).

### 10. Navbar

- **Búsqueda global** con dropdown de resultados (productos reales con precio y stock).
- **Input de tasa** más ancho (`w-16` → `w-24`) y mejor estilo.

### 11. Carga Masiva Excel

Barra de progreso durante importación con nombre del producto actual y contador.

---

## 🏗️ Organización de Carpetas

```
Inventario/
├── app/                        # Páginas Next.js (App Router)
├── components/
│   └── ui/
│       ├── navbar/             # Barra de navegación + búsqueda + tasa
│       ├── sidebar/            # Menú lateral
│       └── layout/             # Layout principal
├── modules/
│   ├── auth/                   # Autenticación y store persistido
│   ├── panel/                  # Dashboard con estadísticas y gráficos
│   ├── products/               # Gestión de productos / inventario
│   │   ├── api/                # Servicios HTTP
│   │   ├── components/         # Componentes React
│   │   ├── store/              # Estado Zustand
│   │   ├── hook/               # Hooks personalizados
│   │   └── types/              # TypeScript types
│   ├── marketplace/            # Órdenes de marketplace
│   ├── general/cajaVentas/     # Caja de ventas (POS)
│   └── cierre-caja/            # Cierre de caja
└── ...
```

---

## Arquitectura de Datos

| Fuente | Origen | Uso |
|---|---|---|
| `medicinesCatalog` | Login (`/login_agent`) | Inventario base (poblado inmediato) |
| `catalog` | API (`/Medications/list`) | Catálogo nacional para búsqueda |
| `inventory` | Store (Zustand) | Fusión de catalog + API + MQTT |
| MQTT | `pharmacy/{id}/insert_inventory` | Sincronización en tiempo real (como Dart) |

> El guardado de productos sigue el mismo patrón que Dart: **local first + MQTT sync**. REST API es best-effort.

---

## Comandos

```bash
pnpm dev       # Desarrollo
pnpm build     # Producción
pnpm lint      # ESLint
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
- **Responsive:** Se transforma automáticamente en "Cards" en dispositivos móviles.

---

## 🔐 Sistema de Autenticación

Implementamos un sistema híbrido que combina la seguridad de **Next-Auth** con la reactividad de **Zustand**.

1. **Next-Auth:** Gestiona el ciclo de vida de la sesión, refresco automático del Token y persistencia en cookies.
2. **Zustand Auth Store:** Sincroniza los datos del perfil del usuario para acceso inmediato.
3. **AuthSync:** Mantiene ambos estados sincronizados.

---

## 📡 Data Fetching & API

### Axios

Configurado con interceptores para:
- Inyectar el `Authorization: Bearer <token>` automáticamente.
- Manejar errores `401` de forma global (logout automático).
- Limpieza de caracteres invisibles en tokens.

### React Query

Utilizamos `QueryProvider` para gestionar el caché con:
- `staleTime`: 1 minuto (por defecto).
- Reintentos automáticos limitados.
- Manejo de errores centralizado.
