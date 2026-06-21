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

export const authService = {
  async login(credentials: { username: string; password: string }): Promise<LoginResponse> {
    const isClient = typeof window !== "undefined";
    if (isClient) {
      const { data } = await axios.post("/api/proxy", {
        url: "/login_agent",
        method: "GET",  // ← CORRECCIÓN: la API requiere GET con body
        data: {
          user: credentials.username,
          password: credentials.password,
          lastLogin: new Date().toISOString(),
        },
      });
      console.log(JSON.stringify(data, null, 2));
      return data;
    } else {
      const { data } = await loginApi.request({
        url: "/login_agent",
        method: "GET",  // ← CORRECCIÓN: la API requiere GET con body
        data: {
          user: credentials.username,
          password: credentials.password,
          lastLogin: new Date().toISOString(),
        },
        headers: { "Content-Type": "application/json" },
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
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
  }

  const agent = data.agentData || data;

  return {
    id: String(agent.agentId || agent.id || ""),
    name: getSafeString(agent.agentUsername || agent.username || agent.user || agent.name),
    email: getSafeString(agent.email),
    role: getSafeString(agent.role || "agent"),
    id_group: String(agent.groupId || agent.id_group || agent.idGroup || ""),
    name_group: String(agent.groupName || agent.name_group || agent.nameGroup || ""),
    pharmacyId: String(agent.pharmacyId || agent.pharmacy_id || agent.idPharmacy || ""),
    pharmacyName: String(agent.pharmacyName || agent.pharmacy_name || agent.namePharmacy || ""),
    rif: getSafeString(agent.rif || agent.rifPharmacy),
    permits: Array.isArray(agent.permitsArray)
      ? agent.permitsArray
      : Array.isArray(agent.permits)
        ? agent.permits
        : [],
    usesDigitalBilling: Boolean(agent.usesDigitalBilling),
    accessToken: data.token || agent.token,
    refreshToken: data.refresh_token || agent.refresh_token,
    expiresAt: Date.now() + ((data.expires_in || agent.expires_in || 3600) as number) * 1000,
  };
};