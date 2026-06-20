import api from "@/modules/core/api/client";

export interface Customer {
  id: string;
  documento: string;
  name: string;
  email: string;
  phone: string;
  direccion: string;
  retencion?: string; // "0" | "75" | "100"
}

// Quita cualquier prefijo alfabético (V, J, E) del documento
const cleanDocument = (doc: string) => {
  return doc.replace(/^[A-Za-z]+/, "").trim();
};

// Convierte la retención de string a número o null para la API
const toApiRetencion = (val?: string): number | null => {
  if (!val || val === "0") return null;
  return parseInt(val, 10); // 75 o 100
};

export const customerService = {
  async searchByDocument(documento: string): Promise<Customer | null> {
    try {
      const { data } = await api.post(
        `/admin/User/searchuser/${documento.toUpperCase()}`,
        {}
      );
      if (!data) return null;
      return {
        id: data.id || data.documento || documento,
        documento: data.documento || data.id || documento,
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        direccion: data.direccion || "",
        retencion: data.retencion != null ? String(data.retencion) : "0",
      };
    } catch {
      return null;
    }
  },

  async create(customer: Omit<Customer, "id">): Promise<Customer | null> {
    try {
      const docLimpio = cleanDocument(customer.documento);
      const { data } = await api.post("/admin/User/createuser", {
        id: docLimpio,
        documento: docLimpio,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        direccion: customer.direccion,
        retencion: toApiRetencion(customer.retencion),
      });
      return {
        id: data.id || customer.documento,
        documento: customer.documento,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        direccion: customer.direccion,
        retencion: customer.retencion || "0",
      };
    } catch {
      return null;
    }
  },
};