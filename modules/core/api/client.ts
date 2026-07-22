import axios from "axios";
import { signOut, getSession, signIn } from "next-auth/react";

const cleanToken = (t: string | undefined) =>
  t ? t.replace(/\s/g, "").replace(/[\x00-\x1F\x7F]/g, "") : "";

// ponytail: global lock, per-user lock if concurrent-user starvation matters
let refreshing: Promise<void> | null = null;

const api = axios.create({ baseURL: "/api/proxy" });

api.interceptors.request.use(async (config) => {
  if ((config as any).skipAuthInterceptor) return config;

  const session: any = await getSession();

  if (session?.error === "RefreshAccessTokenError") {
    signOut({ callbackUrl: "/" });
    return config;
  }

  const token = session?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${cleanToken(token)}`;

  // ponytail: convert every request to POST /api/proxy with body
  // avoids the broken catch-all [...path] route under Turbopack
  if (!(config as any).skipProxyInterceptor) {
    const originalUrl = config.url || "";
    const originalMethod = (config.method || "get").toUpperCase();
    const originalData = config.data;
    const originalParams = config.params;

    const body: Record<string, any> = {
      url: originalUrl,
      method: originalMethod,
    };
    if (originalData !== undefined && originalData !== null) {
      body.data = originalData;
    }
    if (originalParams !== undefined && originalParams !== null) {
      body.params = originalParams;
    }

    config.baseURL = "";
    config.url = "/api/proxy";
    config.method = "post";
    config.data = body;
    config.params = {};
    (config as any).skipProxyInterceptor = true;
  }

  return config;
}, (err) => Promise.reject(err));

api.interceptors.response.use(
  (res) => {
    // Auditoría automática en segundo plano (fire-and-forget)
    try {
      const isProxy = (res.config as any).skipProxyInterceptor;
      if (isProxy && res.config.data) {
        const parsedBody =
          typeof res.config.data === "string"
            ? JSON.parse(res.config.data)
            : res.config.data;
            
        const originalMethod = (parsedBody.method || "GET").toUpperCase();
        const originalUrl = parsedBody.url || "";
        const originalData = parsedBody.data;

        if (["POST", "PUT", "PATCH", "DELETE"].includes(originalMethod)) {
          let action = "UPDATE";
          if (originalMethod === "POST") action = "CREATE";
          if (originalMethod === "DELETE") action = "DELETE";

          // Evitar bucle infinito de logs
          if (!originalUrl.includes("/admin/audit/logs")) {
            // Extraer nombre aproximado de la entidad (ej: /admin/products -> products)
            const parts = originalUrl.split("?")[0].split("/").filter(Boolean);
            const entityName = parts.length > 0 ? parts.join("/") : "system";

            // Normalizar a objeto puro (Map en backend)
            const normalize = (d: any) => {
              if (d === null || d === undefined) return null;
              if (Array.isArray(d)) return { items: d };
              if (typeof d !== "object") return { value: d };
              return d;
            };

            const normData = normalize(originalData);

            // Se envía usando axios directo para evitar loops de interceptores
            axios.post(
              "/api/proxy",
              {
                url: "/admin/audit/logs",
                method: "POST",
                data: {
                  action,
                  entity_name: entityName,
                  entity_id: "auto",
                  new_values: action === "DELETE" ? null : (normData ?? null),
                  old_values: action === "CREATE" ? null : (action === "DELETE" ? (normData ?? {}) : {}),
                },
              },
              {
                headers: {
                  Authorization: res.config.headers?.Authorization,
                },
              }
            ).catch(() => {});
          }
        }
      }
    } catch (e) {
      // Ignorar errores del log para no detener el flujo principal
    }

    return res;
  },
  async (err) => {
    const req = err.config;
    const status = err.response?.status;

    if ((req as any).skipAuthInterceptor) return Promise.reject(err);

    const isAuthError = [401, 402, 403].includes(status);

    if (isAuthError && !req._retry) {
      req._retry = true;
      let session: any = await getSession();

      if (session?.refreshToken && !session?.error) {
        if (!refreshing) {
          refreshing = (async () => {
            const timeout = new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error("Refresh timeout")), 10_000)
            );
            try {
              const result = await Promise.race([
                signIn("credentials", {
                  isRefresh: "true",
                  refreshToken: session.refreshToken,
                  userData: JSON.stringify(session.user),
                  redirect: false,
                }),
                timeout,
              ]);
              if (result?.error) throw new Error(result.error);
            } catch (e) {
              console.error("[Auth] Token refresh failed:", e);
            } finally {
              refreshing = null;
            }
          })();
        }
        await refreshing;

        session = await getSession();
        if (session?.accessToken) {
          req.headers.Authorization = `Bearer ${cleanToken(session.accessToken)}`;
          return api(req);
        }
      }
      signOut({ callbackUrl: "/" });
    }
    return Promise.reject(err);
  }
);

export default api;
