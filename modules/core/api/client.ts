import axios from "axios";
import { signOut, getSession, signIn } from "next-auth/react";

const cleanToken = (t: string | undefined) =>
  t ? t.replace(/\s/g, "").replace(/[\x00-\x1F\x7F]/g, "") : "";

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

api.interceptors.request.use(async (config) => {
  if ((config as any).skipAuthInterceptor) return config;

  const session: any = await getSession();

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

    if ((req as any).skipAuthInterceptor) return Promise.reject(err);

    const isAuthError = [401, 402, 403].includes(status);

    if (isAuthError && !req._retry) {
      req._retry = true;
      let session: any = await getSession();

      if (session?.accessToken && !session?.error) {
        req.headers.Authorization = `Bearer ${cleanToken(session.accessToken)}`;
        return api(req);
      }

      if (session?.refreshToken && !session?.error) {
        try {
          const result = await signIn("credentials", {
            isRefresh: "true",
            refreshToken: session.refreshToken,
            userData: JSON.stringify(session.user),
            redirect: false,
          });

          if (result?.error) throw new Error(result.error);

          session = await getSession();
          if (session?.accessToken) {
            req.headers.Authorization = `Bearer ${cleanToken(session.accessToken)}`;
            return api(req);
          }
        } catch {
          // Refresh failed - will sign out below
        }
      }
      signOut({ callbackUrl: "/" });
    }
    return Promise.reject(err);
  }
);

export default api;
