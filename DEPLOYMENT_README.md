Problema: "Cannot find name 'useProductsStore'" y errores de build relacionados.

Causa común:
- Import faltante o referencia a un store fuera de alcance. TypeScript también puede marcar propiedades como "posiblemente undefined".

Solución aplicada:
- Asegurar import: añadida la línea: import { useProductsStore } from "@/modules/products/store/products.store";
- Proteger accesos opcionales: cambiar bucles a for (const ni of (normalized.items || [])) { }

Pasos para desplegar en producción (checklist):
1. Ejecutar localmente: pnpm install && pnpm run build
2. Si falla en Docker: asegúrate de usar la versión de Node.js soportada (v20+ en este repo). En Dockerfile, define NODE_VERSION compatible.
3. Usar --frozen-lockfile si confías en pnpm-lock.yaml; si falla, intenta limpiar cache: pnpm store prune && pnpm install
4. Revisar errores TypeScript: sigue las pistas y añade protecciones (?. o || []) cuando corresponda.
5. CI/CD: ejecutar pnpm run build en pipeline y capturar logs; evita --silent que oculte errores.

Si ocurre ERR_UNKNOWN_BUILTIN_MODULE durante pnpm install en CI, prueba a cambiar la versión de pnpm o node en el runner, o actualizar dependencias nativas.

Contacto rápido: incluir los logs completos del build y el archivo modules/marketplace/providers/MqttOrdersProvider.tsx si persiste el error.