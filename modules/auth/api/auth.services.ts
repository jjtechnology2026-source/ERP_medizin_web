import axios from "axios";

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

export const authService = {
  async login(credentials: any) {
    const { data } = await api.request({
      url: "/login_agent",
      method: "GET",
      data: {
        user: credentials.username,
        password: credentials.password,
        lastLogin: new Date().toISOString(),
      },
      headers: {
        "Content-Type": "application/json",
      },
    });
    return data;
  },
  async refresh(token: string) {
    const { data } = await api.post("/auth/refresh-token", { token });
    return data;
  }
};

export const mapUserData = (data: any, isDirect = false) => {
  if (isDirect) {
    const group = data.grouppharmacy;
    const user = data.admin || data.user || group?.proprietary;
    return {
      id: String(user?.id || group?.id || ""),
      name: group?.proprietary?.name || user?.name || group?.name_group || "",
      email: user?.email || group?.credentials?.user || "",
      role: user?.rol || user?.role || "pharmacy_group",
      id_group: String(group?.id_group || user?.id_group || ""),
      permits: user?.permits || group?.permits || [],
      name_group: String(group?.name_group || user?.name_group || ""),
      pharmacies: group?.sucursales || [],
      accessToken: data.token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
  }
  return {
    id: String(data.agentId),
    name: data.agentUsername,
    email: data.email,
    role: data.role,
    id_group: data.groupId,
    name_group: data.groupName,
    pharmacyId: data.pharmacyId,
    pharmacyName: data.pharmacyName,
    rif: data.rif,
    permits: data.permitsArray || [],
    usesDigitalBilling: data.usesDigitalBilling,
    accessToken: data.token,
    refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 300) * 1000,
  };
};