import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // Bypass para desarrollo: si TEST_MODE está activado, permitir acceso sin token
    if (process.env.NEXT_PUBLIC_TEST_MODE === "true") {
      return NextResponse.next();
    }

    // 1. Manejo de errores de sesión
    if (token?.error === "RefreshAccessTokenError" && pathname !== "/") {
      const url = new URL("/", req.url);
      url.searchParams.set("error", "SessionExpired");
      return NextResponse.redirect(url);
    }

    // 2. Evitar bucle: Si ya estoy en / no redirecciono a /panel de nuevo
    // Solo si el usuario está autenticado (y sin errores) e intenta acceder explícitamente a la raíz
    if (pathname === "/" && token && !token.error) {
      return NextResponse.redirect(new URL("/panel", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Solo pedimos autenticación si NO estamos en la página de login
      authorized: ({ token, req }) => {
        // Bypass para desarrollo
        if (process.env.NEXT_PUBLIC_TEST_MODE === "true") return true;

        if (req.nextUrl.pathname === "/") return true;
        return !!token;
      },
    },
  }
);

export const config = {
  /*
   * Matcher ultra-seguro:
   * Protege todo EXCEPTO:
   * - api (rutas de backend de NextAuth)
   * - _next/static (estilos y scripts de Next.js)
   * - _next/image (optimización de imágenes)
   * - favicon.ico y archivos estáticos en public (svg, png, jpg, etc.)
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|json)).*)"],
};