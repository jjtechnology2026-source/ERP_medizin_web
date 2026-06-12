# 🧪 Modo Test: Acceso y Mocks Pro

He implementado un sistema dual para facilitar tus pruebas de interfaz.

## 1. Botón de Bypass "Ver Interfaz"

Cuando actives el modo test, aparecerá un botón verde en el Login que te permite entrar directamente al panel sin escribir nada.

## Cómo activarlo/desactivarlo

En tu archivo `.env.local`:

```env
# Muestra el botón de bypass y usa datos ficticios (Mocks)
NEXT_PUBLIC_TEST_MODE=true

# Oculta el botón y usa la API real de Medizin
NEXT_PUBLIC_TEST_MODE=false
```

> [!IMPORTANT]
> Debes reiniciar el servidor (`pnpm run dev`) después de cambiar esta variable.

## 2. Sistema de Datos Mock

Si el modo test está en `true`, el sistema interceptará las peticiones a la API y devolverá datos de prueba que he preparado para:

- **Panel General**: Estadísticas de ventas y órdenes.
- **Ventas Totales**: Reportes por farmacia.
- **Reportes de Agentes**: Comisiones y cierres.

## ¿Dónde se cambian los datos de prueba?

Si quieres modificar los números que ves en pantalla, edita el archivo:
`lib/mocks.ts`

## Cambio rápido a Datos Reales

Para volver a conectar con el backend real, simplemente pon la variable en `false` y loguéate normalmente con tus credenciales de usuario.
