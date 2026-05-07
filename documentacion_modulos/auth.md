# Auth

Documento técnico del módulo de autenticación (`modules/auth`). Explica la estructura, responsabilidades y ejemplos prácticos de uso desde la perspectiva de integración en la app.

Propósito

- Gestionar el flujo de autenticación (login, refresco de tokens, logout).
- Proveer hooks y componentes reutilizables para el frontend (`useLoginForm`, `useAuthStore`, `LoginWrapper`, `AuthSync`).
- Centralizar llamadas a la API relacionadas con autenticación en `api/auth.services.ts`.

```
Explicación: define la forma de las credenciales y el perfil de usuario esperados. Sirve como guía para cualquier función que maneje autenticación (servicios, stores, componentes).

Estructura y responsabilidades (archivo por archivo)

- `index.tsx`
  - Entry point del módulo. Contiene el formulario de login y el botón de bypass en modo test.
  - Orquesta la interacción entre `useLoginForm`, `useAuthStore` y la navegación (`next/navigation`).
```

Explicación: estos snippets muestran cómo centralizar llamadas de auth en `auth.services.ts`. Úsalos para aislar la lógica de red y facilitar mocks en pruebas.

- `api/auth.services.ts`
  - Cliente ligero con funciones para `signIn`, `signOut`, `refreshToken`, y endpoints relacionados con autenticación.
  - Todas las llamadas externas relacionadas con auth deben centralizarse aquí para facilitar pruebas y cambios de API.

- `hooks/useLoginForm.ts`

```
Explicación: el ejemplo de `useLoginForm` ilustra la responsabilidad del hook: validar, llamar al servicio y actualizar el store. No mezcles lógica de presentación aquí.
  - Hook que encapsula el estado del formulario de login: `username`, `password`, `isLoading`, `error`, y la función `handleLogin`.
  - Realiza validaciones básicas (no vacíos), llama a `auth.services` o a `signIn` de NextAuth, y actualiza el estado global cuando procede.

- `components/LoadingOverlay.tsx` y `LoginWrapper.tsx`
  - Componentes UI reutilizables para la pantalla de login. `LoadingOverlay` muestra estados de carga y `LoginWrapper` provee el layout visual.
```

Explicación: ejemplo mínimo de cómo exponer mutadores en el store (`useAuthStore`). Mantén funciones pequeñas y descriptivas para facilitar pruebas y trazabilidad.

- `components/AuthSync.tsx`
  - Componente responsable de sincronizar estado de sesión entre tabs o con el almacenamiento local si procede.

Explicación: este `useEffect` muestra la limpieza de sesión tras un error de refresh redirigido por la `middleware`. Es el punto correcto para llamar a `logout()` y borrar estado local.

- `store/useAuthStore.ts`
  - Almacén local (p. ej. Zustand) que guarda `profile`, `startedSession`, `tokens` u otros datos de sesión que la UI necesita.

Comportamiento clave y flujo

1. Usuario completa correo/usuario y contraseña en el formulario provisto por `index.tsx`.
2. `useLoginForm.handleLogin` se activa:
   - valida entradas
   - llama a `auth.services.signIn(credentials)` o a `signIn('credentials', ...)` según la implementación
   - al recibir éxito, guarda la información relevante en `useAuthStore` y redirige a `/panel`
3. El cliente HTTP (`modules/core/api/client.ts`) incluye interceptores que usan la sesión (`getSession()`) para añadir `Authorization` a las peticiones.
4. En caso de errores de refresh la `middleware` redirige a `/` con `?error=SessionExpired` y `useEffect` en `index.tsx` limpia la sesión llamando a `logout()`.

# Auth

Documento técnico del módulo de autenticación (`modules/auth`). Explica la estructura, responsabilidades y ejemplos prácticos de uso desde la perspectiva de integración en la app.

Propósito

- Gestionar el flujo de autenticación (login, refresco de tokens, logout).
- Proveer hooks y componentes reutilizables para el frontend (`useLoginForm`, `useAuthStore`, `LoginWrapper`, `AuthSync`).
- Centralizar llamadas a la API relacionadas con autenticación en `api/auth.services.ts`.

Estructura y responsabilidades (archivo por archivo)

- `index.tsx`
  - Entry point del módulo. Contiene el formulario de login y el botón de bypass en modo test.
  - Orquesta la interacción entre `useLoginForm`, `useAuthStore` y la navegación (`next/navigation`).

- `api/auth.services.ts`
  - Cliente ligero con funciones para `signIn`, `signOut`, `refreshToken`, y endpoints relacionados con autenticación.
  - Todas las llamadas externas relacionadas con auth deben centralizarse aquí para facilitar pruebas y cambios de API.

- `hooks/useLoginForm.ts`
  - Hook que encapsula el estado del formulario de login: `username`, `password`, `isLoading`, `error`, y la función `handleLogin`.
  - Realiza validaciones básicas (no vacíos), llama a `auth.services` o a `signIn` de NextAuth, y actualiza el estado global cuando procede.

- `components/LoadingOverlay.tsx` y `LoginWrapper.tsx`
  - Componentes UI reutilizables para la pantalla de login. `LoadingOverlay` muestra estados de carga y `LoginWrapper` provee el layout visual.

- `components/AuthSync.tsx`
  - Componente responsable de sincronizar estado de sesión entre tabs o con el almacenamiento local si procede.

- `store/useAuthStore.ts`
  - Almacén local (p. ej. Zustand) que guarda `profile`, `startedSession`, `tokens` u otros datos de sesión que la UI necesita.

Comportamiento clave y flujo

1. Usuario completa correo/usuario y contraseña en el formulario provisto por `index.tsx`.
2. `useLoginForm.handleLogin` se activa:
   - valida entradas
   - llama a `auth.services.signIn(credentials)` o a `signIn('credentials', ...)` según la implementación
   - al recibir éxito, guarda la información relevante en `useAuthStore` y redirige a `/panel`
3. El cliente HTTP (`modules/core/api/client.ts`) incluye interceptores que usan la sesión (`getSession()`) para añadir `Authorization` a las peticiones.
4. En caso de errores de refresh la `middleware` redirige a `/` con `?error=SessionExpired` y `useEffect` en `index.tsx` limpia la sesión llamando a `logout()`.

Modo Test / Bypass (comportamiento observado)

- `index.tsx` lee `process.env.NEXT_PUBLIC_TEST_MODE === "true"` y, si es verdad, muestra un botón **Ver interfaz (Bypass)**.
- El botón ejecuta `localStorage.setItem('startedSession', 'true')` y navega a `/panel` sin credenciales.
- Recuerda: cambiar `.env.local` requiere reiniciar el servidor para que Next.js recargue las variables.

Snippets y ejemplos prácticos

- `types` (ejemplo mínimo de interfaces usadas por el módulo):

```ts
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthProfile {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  image?: string;
}
```

Explicación: define la forma de las credenciales y el perfil de usuario esperados. Úsalo como contrato para servicios, hooks y stores.

- `auth.services.ts` (ejemplo de funciones expuestas):

```ts
import api from "@/modules/core/api/client";

export const signInService = async (credentials: LoginCredentials) => {
  const res = await api.post("/auth/login", credentials);
  return res.data;
};

export const refreshTokenService = async (refreshToken: string) => {
  const res = await api.post("/auth/refresh", { refreshToken });
  return res.data;
};
```

Explicación: estos snippets muestran cómo centralizar llamadas de auth en `auth.services.ts`. Aísla la lógica de red y facilita mocking en tests.

- `useLoginForm` (ejemplo simplificado):

```ts
// dentro de useLoginForm.ts
const handleLogin = async (e) => {
  e.preventDefault();
  setIsLoading(true);
  try {
    const data = await signInService({ username, password });
    // actualizar store, por ejemplo:
    useAuthStore.getState().setProfile(data.user);
    router.push("/panel");
  } catch (err) {
    setError("Credenciales inválidas");
  } finally {
    setIsLoading(false);
  }
};
```

Explicación: ilustra la responsabilidad del hook: validar, llamar al servicio y actualizar el store. Mantén este hook libre de lógica de presentación.

- Interacción con `useAuthStore` (ejemplo):

```ts
// setProfile en el store
function setProfile(profile: AuthProfile) {
  set({ profile });
}
```

Explicación: ejemplo mínimo de cómo exponer mutadores en el store (`useAuthStore`). Mantén funciones pequeñas y con una sola responsabilidad.

- Manejo del estado de sesión y limpieza tras refresh error (snippet tomado de `index.tsx`):

```ts
React.useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("error") === "SessionExpired") {
    logout(); // logout limpia store y localStorage
  }
}, [logout]);
```

Explicación: este `useEffect` muestra la limpieza de sesión tras un error de refresh redirigido por la `middleware`. Es el lugar correcto para borrar estado local y tokens.
