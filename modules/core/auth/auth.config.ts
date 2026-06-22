import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authService, mapUserData, TOKEN_EXPIRY_FALLBACK_SECONDS, decodeJwtExp } from "@/modules/auth/api/auth.services";

// ponytail: global lock, same purpose as the one in api/client.ts — prevent concurrent refreshes
let tokenRefreshPromise: Promise<void> | null = null;

export const authOptions: NextAuthOptions = {
 providers: [
  CredentialsProvider({
    name: "Credentials",
    // Definimos los campos para que TS sepa que existen
    credentials: {
      isRefresh: { type: "text" },
      isDirectLogin: { type: "text" },
      userData: { type: "text" },
      refreshToken: { type: "text" },
      username: { type: "text" },
      email: { type: "text" },
      password: { type: "password" }
    }, 
    async authorize(credentials) {
      try {
        if (!credentials) return null;

        if (credentials.isRefresh === "true") {
          const data = await authService.refresh(credentials.refreshToken);
          const user = JSON.parse(credentials.userData as string);
          const now = Date.now();
          const expiresInSec = data.expires_in
            ?? Math.max(60, (decodeJwtExp(data.token) - now) / 1000 || TOKEN_EXPIRY_FALLBACK_SECONDS);
          
          return { 
            ...user, 
            accessToken: data.token, 
            refreshToken: data.refresh_token ?? credentials.refreshToken, 
            expiresAt: now + expiresInSec * 1000
          };
        }

        if (credentials.isDirectLogin === "true") {
          return mapUserData(JSON.parse(credentials.userData as string), true);
        }

        const loginIdentifier = credentials.username || credentials.email;
        if (!loginIdentifier || !credentials.password) return null;

        const data = await authService.login({
          username: loginIdentifier,
          password: credentials.password
        });

        if (data.success === false) {
          throw new Error(data.message || "Credenciales inválidas");
        }
        
        return mapUserData(data);
      } catch (e: any) {
        const message = e.response?.data?.message || e.message || "Error de autenticación";
        throw new Error(message);
      }
    },
  }),
],
  callbacks: {
    // 1. Tipamos token y user como 'any' aquí para que deje de chillar por las propiedades
    async jwt({ token, user }: any) {
      // Login inicial (solo ocurre una vez al autenticar)
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.expiresAt = user.expiresAt;
        token.user = user;
        return token;
      }

      const now = Date.now();

      // 2. Verificación de tiempo
      if (now < (token.expiresAt as number)) {
        return token;
      }

      // 3. Si ya hay un refresh en curso, esperarlo sin lanzar otro
      if (tokenRefreshPromise) {
        await tokenRefreshPromise;
        return token;
      }

      // 4. Silent Refresh si el tiempo expiró
      tokenRefreshPromise = (async () => {
        try {
          const d = await authService.refresh(token.refreshToken);
          token.accessToken = d.token;
          token.refreshToken = d.refresh_token ?? token.refreshToken;
          const expiresInSec = d.expires_in
            ?? Math.max(60, (decodeJwtExp(d.token) - now) / 1000 || TOKEN_EXPIRY_FALLBACK_SECONDS);
          token.expiresAt = now + expiresInSec * 1000;
        } catch (e) {
          token.error = "RefreshAccessTokenError";
          token.expiresAt = now + 300_000; // 5 min cooldown — no reintentar en cada request
        } finally {
          tokenRefreshPromise = null;
        }
      })();

      await tokenRefreshPromise;
      return token;
    },

    async session({ session, token }: any) {
      // 4. Inyectamos todo en la sesión
      session.user = token.user;
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.error = token.error;
      return session;
    },
  },
  // --- CONFIGURACIÓN DE SEGURIDAD ABSOLUTA ---
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true, // Bloquea acceso desde document.cookie (Anti-XSS)
        sameSite: "lax", // Protege contra CSRF
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: { signIn: "/" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};