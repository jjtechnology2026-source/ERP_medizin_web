import axios from "axios";

const loginApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

interface LoginResponse {
  success?: boolean;
  token?: string;
  refresh_token?: string;
  expires_in?: number;
  agentData?: Record<string, any>;
  [key: string]: any;
}

export const TOKEN_EXPIRY_FALLBACK_SECONDS = 3600;

/**
 * Con qué documento emite la farmacia (`odd/tasks/modo-facturacion-simple.md`,
 * Spec S1):
 *  - `digital`: el backend emite (TFHKA).
 *  - `fiscal`: la máquina fiscal de la terminal emite y el POS toma el COO.
 *  - `simple`: no hay comprobante fiscal ni papel; la cadena contable la
 *    escribe el backend con su propia numeración.
 */
export type ModoFacturacion = "digital" | "fiscal" | "simple";

/**
 * Modo de facturación del perfil, con el default que no cambia a nadie.
 *
 * El backend manda `modoFacturacion` en `login_agent`. Cuando falta —sesión
 * emitida antes de que existiera el campo, o respuesta de un backend viejo— se
 * deriva de `usesDigitalBilling`, que es el único dato con el que se elegía el
 * camino hasta hoy: digital si facturaba por backend, fiscal si no. Así ninguna
 * farmacia cambia de comportamiento por no tener el campo.
 */
export function resolveModoFacturacion(source?: unknown): ModoFacturacion {
  // `unknown` y no una forma estructural: el perfil y la respuesta del backend
  // son tipos abiertos, y el modo se lee de lo que venga.
  const shaped = (source ?? {}) as { modoFacturacion?: unknown; usesDigitalBilling?: unknown };
  const raw =
    typeof shaped.modoFacturacion === "string"
      ? shaped.modoFacturacion.trim().toLowerCase()
      : "";
  if (raw === "digital" || raw === "fiscal" || raw === "simple") return raw;
  return shaped.usesDigitalBilling ? "digital" : "fiscal";
}

export function decodeJwtExp(token: string | undefined): number {
  try {
    if (!token) return TOKEN_EXPIRY_FALLBACK_SECONDS * 1000;
    const parts = token.split(".");
    if (parts.length !== 3) return TOKEN_EXPIRY_FALLBACK_SECONDS * 1000;

    // URL-safe base64 → standard base64
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";

    const decoded = JSON.parse(atob(payload));
    if (typeof decoded.exp !== "number") return TOKEN_EXPIRY_FALLBACK_SECONDS * 1000;

    return decoded.exp * 1000;
  } catch {
    return TOKEN_EXPIRY_FALLBACK_SECONDS * 1000;
  }
}

export const authService = {
  async login(credentials: { username: string; password: string }): Promise<LoginResponse> {
    const isClient = typeof window !== "undefined";
    if (isClient) {
      const { data } = await axios.post("/api/proxy", {
        url: "/login_agent",
        method: "POST",
        data: {
          user: credentials.username,
          password: credentials.password,
          lastLogin: new Date().toISOString(),
        },
      }, { timeout: 20000 });
      console.log(JSON.stringify(data, null, 2));
      return data;
    } else {
      const { data } = await loginApi.request({
        url: "/login_agent",
        method: "POST",
        data: {
          user: credentials.username,
          password: credentials.password,
          lastLogin: new Date().toISOString(),
        },
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
      });
      return data;
    }
  },

  async refresh(token: string): Promise<{ token: string; refresh_token?: string; expires_in?: number }> {
    const { data } = await loginApi.post("/auth/refresh-token", { token });
    return data;
  },
};

export const mapUserData = (data: LoginResponse, isDirect = false) => {
  const isAgent = Boolean(
    data.agentId || 
    data.agentUsername || 
    data.agentData || 
    (data.role && data.role !== "pharmacy_group" && data.role !== "group")
  );

  const getSafeString = (val: any): string => {
    if (!val) return "";
    if (typeof val === "string") return val.trim();
    if (typeof val === "object") {
      return String(val.name || val.username || val.user || val.agentUsername || "").trim();
    }
    return String(val).trim();
  };

  if (isDirect && !isAgent && data.grouppharmacy) {
    const group = data.grouppharmacy;
    const user = data.admin || data.user || group?.proprietary;
    return {
      id: String(user?.id || group?.id || ""),
      name: getSafeString(group?.proprietary?.name || user?.name || group?.name_group),
      email: getSafeString(user?.email || group?.credentials?.user || user?.user),
      role: getSafeString(user?.rol || user?.role || "pharmacy_group"),
      id_group: String(group?.id_group || user?.id_group || ""),
      name_group: String(group?.name_group || user?.name_group || ""),
      pharmacyId: String(group?.id || user?.pharmacy_id || ""),
      pharmacyName: String(group?.name_group || ""),
      permits: user?.permits || group?.permits || [],
      pharmacies: group?.sucursales || [],
      accessToken: data.token,
      refreshToken: data.refresh_token,
      expiresAt: decodeJwtExp(data.token),
    };
  }

  const agent = data.agentData || data;

  return {
    id: String(agent.agentId || agent.id || ""),
    name: getSafeString(agent.agentUsername || agent.username || agent.user || agent.name),
    email: getSafeString(agent.email),
    role: getSafeString(agent.role || "agent"),
    id_group: String(agent.groupId || agent.id_group || agent.idGroup || agent.group_id || ""),
    name_group: String(agent.groupName || agent.name_group || agent.nameGroup || ""),
    pharmacyId: String(agent.pharmacyId || agent.pharmacy_id || agent.idPharmacy || ""),
    pharmacyName: String(agent.pharmacyName || agent.pharmacy_name || agent.namePharmacy || ""),
    rif: getSafeString(agent.rif || agent.rifPharmacy),
    pharmacyAddress: getSafeString(agent.pharmacyAddress || agent.addressPharmacy),
    pharmacyPhone: getSafeString(agent.pharmacyPhone || agent.phonePharmacy),
    permits: Array.isArray(agent.permitsArray)
      ? agent.permitsArray
      : Array.isArray(agent.permits)
        ? agent.permits
        : [],
    usesDigitalBilling: Boolean(agent.usesDigitalBilling),
    // El modo manda sobre la detección de la terminal (Spec S3): con `simple` el
    // POS no resuelve canal. `resolveModoFacturacion` cubre las sesiones que no
    // lo traen derivándolo de `usesDigitalBilling`.
    modoFacturacion: resolveModoFacturacion(agent),
    cajaId: agent.cajaId ?? null,
    accessToken: data.token || agent.token,
    refreshToken: data.refresh_token || agent.refresh_token,
    expiresAt: decodeJwtExp(data.token || agent.token),
  };
};