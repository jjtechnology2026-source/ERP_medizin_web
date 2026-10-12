import api from "@/modules/core/api/client";
import type {
  FiscalNoteCreateRequest,
  FiscalNoteResponse,
  FiscalNoteDetail,
  FiscalNotesFilter,
} from "@/modules/cash-register/types/fiscal-notes.types";

export interface FiscalNoteResult {
  success: boolean;
  statusCode: number;
  message: string;
  response: FiscalNoteResponse | null;
  details: string | null;
}

export interface FiscalNoteListResult {
  success: boolean;
  statusCode: number;
  message: string;
  items: FiscalNoteDetail[];
  details: string | null;
}

export interface FiscalNoteDetailResult {
  success: boolean;
  statusCode: number;
  message: string;
  item: FiscalNoteDetail | null;
  details: string | null;
}

export const fiscalNotesService = {
  async createNotaCredito(dto: FiscalNoteCreateRequest): Promise<FiscalNoteResult> {
    return createFiscalNote("/admin/Facturacion/nota_credito", dto);
  },

  async listNotasCredito(filter: FiscalNotesFilter = {}): Promise<FiscalNoteListResult> {
    return listFiscalNotes("/admin/Facturacion/nota_credito", filter);
  },

  async getNotaCredito(id: string): Promise<FiscalNoteDetailResult> {
    return getFiscalNote("/admin/Facturacion/nota_credito", id);
  },
};

async function createFiscalNote(endpoint: string, dto: FiscalNoteCreateRequest): Promise<FiscalNoteResult> {
  try {
    const { data } = await api.post(endpoint, dto);
    return {
      success: true,
      statusCode: 200,
      message: "Nota fiscal emitida correctamente",
      response: data as FiscalNoteResponse,
      details: null,
    };
  } catch (e: any) {
    const status = e.response?.status || 0;
    const rawData = e.response?.data;
    return {
      success: false,
      statusCode: status,
      message: rawData?.message || rawData?.error || e.message || "Error al emitir nota fiscal",
      response: null,
      details: typeof rawData === "string" ? rawData : JSON.stringify(rawData),
    };
  }
}

async function listFiscalNotes(endpoint: string, filter: FiscalNotesFilter): Promise<FiscalNoteListResult> {
  try {
    const params: Record<string, string> = {};
    if (filter.order_id) params.order_id = filter.order_id;
    if (filter.pharmacy_id) params.pharmacy_id = filter.pharmacy_id;
    if (filter.search) params.search = filter.search;
    if (filter.numero_control) params.numero_control = filter.numero_control;
    if (filter.fecha_desde) params.fecha_desde = filter.fecha_desde;
    if (filter.fecha_hasta) params.fecha_hasta = filter.fecha_hasta;

    const { data } = await api.get(endpoint, { params });
    const items = Array.isArray(data) ? data : data?.data ?? [];
    return {
      success: true,
      statusCode: 200,
      message: "Notas fiscales obtenidas",
      items,
      details: null,
    };
  } catch (e: any) {
    const status = e.response?.status || 0;
    return {
      success: false,
      statusCode: status,
      message: e.message || "Error al listar notas fiscales",
      items: [],
      details: null,
    };
  }
}

async function getFiscalNote(endpoint: string, id: string): Promise<FiscalNoteDetailResult> {
  try {
    const { data } = await api.get(`${endpoint}/${id}`);
    return {
      success: true,
      statusCode: 200,
      message: "Nota fiscal obtenida",
      item: data as FiscalNoteDetail,
      details: null,
    };
  } catch (e: any) {
    const status = e.response?.status || 0;
    return {
      success: false,
      statusCode: status,
      message: e.message || "Error al obtener nota fiscal",
      item: null,
      details: null,
    };
  }
}
