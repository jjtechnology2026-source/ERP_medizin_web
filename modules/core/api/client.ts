import axios from "axios";
import { signOut, getSession, signIn } from "next-auth/react";

// Limpia espacios y caracteres de control del token
const cleanToken = (t: string | undefined) => t ? t.replace(/\s/g, "").replace(/[\x00-\x1F\x7F]/g, "") : "";

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

api.interceptors.request.use(async (config) => {
  const session: any = await getSession();

  // Si hay error de refresco en la sesión, cerrar sesión inmediatamente
  if (session?.error === "RefreshAccessTokenError") {
    signOut({ callbackUrl: "/" });
    return config;
  }

  const token = session?.accessToken || process.env.NEXT_PUBLIC_JWT;
  if (token) config.headers.Authorization = `Bearer ${cleanToken(token)}`;
  
  return config;
}, (err) => Promise.reject(err));

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const req = err.config;
    const status = err.response?.status;

    // Manejo de errores de autorización (401, 402, 403) para reintento único
    if ([401, 402, 403].includes(status) && !req._retry) {
      req._retry = true;
      const session: any = await getSession();
      
      if (session?.refreshToken && !session?.error) {
        // Intentar refresh
        try {
          await signIn("credentials", { 
            isRefresh: "true", 
            refreshToken: session.refreshToken, 
            userData: JSON.stringify(session.user) 
          });
          
          // Obtener nueva sesión
          const newSession: any = await getSession();
          if (newSession?.accessToken) {
            req.headers.Authorization = `Bearer ${cleanToken(newSession.accessToken)}`;
            return api(req); // Reintenta la petición con el nuevo token
          }
        } catch (refreshErr) {
          // Si refresh falla, cerrar sesión
        }
      }
      signOut({ callbackUrl: "/" });
    }
    return Promise.reject(err);
  }
);

export default api;