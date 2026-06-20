import api from "@/modules/core/api/client";
import type {
  ZReportResult,
  ZReportResponse,
  ZReportData,
  ZReportCompany,
  ZReportConsecutiveControl,
  ZReportSummary,
  ZReportOtherDayCancellations,
  ZReportCashRegister,
  ZReportAmount,
  ZReportSession,
} from "@/modules/cash-register/types/fiscal-z-report.types";

function readString(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

function readDouble(val: unknown): number {
  if (typeof val === "number") return val;
  const parsed = parseFloat(String(val ?? ""));
  return isNaN(parsed) ? 0 : parsed;
}

function readInt(val: unknown): number {
  if (typeof val === "number") return Math.floor(val);
  const parsed = parseInt(String(val ?? ""), 10);
  return isNaN(parsed) ? 0 : parsed;
}

function readBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  const s = String(val ?? "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "si";
}

function readNullableString(val: unknown): string | null {
  const s = readString(val);
  if (!s || s === "null") return null;
  return s;
}

function readMap(val: unknown): Record<string, unknown> | null {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return null;
}

function readStringList(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => readString(v)).filter(Boolean);
}

function readSessions(val: unknown): ZReportSession[] {
  if (!Array.isArray(val)) return [];
  return val.map((item) => {
    const m = readMap(item) || {};
    return {
      id: readNullableString(m["id"]),
      cajaId: readString(m["caja_id"]),
      usuarioAperturaId: readString(m["usuario_apertura_id"]),
      usuarioCierreId: readNullableString(m["usuario_cierre_id"]),
      fechaApertura: readString(m["fecha_apertura"]),
      fechaCierre: readNullableString(m["fecha_cierre"]),
      montoAperturaVes: readDouble(m["monto_apertura_ves"]),
      montoAperturaUsd: readDouble(m["monto_apertura_usd"]),
      montoCierreFisicoVes: readDouble(m["monto_cierre_fisico_ves"]),
      montoCierreFisicoUsd: readDouble(m["monto_cierre_fisico_usd"]),
      totalVentasVes: readDouble(m["total_ventas_ves"]),
      totalVentasUsd: readDouble(m["total_ventas_usd"]),
      totalGastosVes: readDouble(m["total_gastos_ves"]),
      totalGastosUsd: readDouble(m["total_gastos_usd"]),
      diferenciaVes: readDouble(m["diferencia_ves"]),
      diferenciaUsd: readDouble(m["diferencia_usd"]),
      estado: readString(m["estado"]),
      estadoApertura: readString(m["estado_apertura"]),
      usuarioAprobacionAperturaId: readNullableString(m["usuario_aprobacion_apertura_id"]),
      fechaAprobacionApertura: readNullableString(m["fecha_aprobacion_apertura"]),
      estadoCierre: readNullableString(m["estado_cierre"]),
      usuarioAprobacionCierreId: readNullableString(m["usuario_aprobacion_cierre_id"]),
      fechaAprobacionCierre: readNullableString(m["fecha_aprobacion_cierre"]),
      observacionesCierre: readNullableString(m["observaciones_cierre"]),
    } as ZReportSession;
  }).filter(Boolean);
}

function parseAmount(val: unknown): ZReportAmount | null {
  const m = readMap(val);
  if (!m) return null;
  return { ves: readDouble(m["ves"]), usd: readDouble(m["usd"]) };
}

function parseCashRegister(val: unknown): ZReportCashRegister | null {
  const m = readMap(val);
  if (!m) return null;
  return {
    id: readNullableString(m["id"]),
    codigo: readString(m["codigo"]),
    nombre: readString(m["nombre"]),
    montoBaseVes: readDouble(m["monto_base_ves"]),
    montoBaseUsd: readDouble(m["monto_base_usd"]),
    ubicacion: readNullableString(m["ubicacion"]),
    estado: readString(m["estado"]),
    createdAt: readString(m["created_at"]),
  };
}

function parseReportData(json: Record<string, unknown>): ZReportData {
  const reporteZJson = readMap(json["ReporteZ"]) || readMap(json["Reportez"]) || readMap(json["reportez"]) || {};

  return {
    empresa: (() => {
      const m = readMap(json["empresa"]);
      if (!m) return null;
      return {
        razonSocial: readString(m["razonsocial"]),
        rif: readString(m["rif"]),
        direccion: readString(m["direccion"]),
        telefono: readString(m["telefono"]),
        email: readString(m["email"]),
      } as ZReportCompany;
    })(),
    fechaReporte: readString(json["Fecha_Reporte"]),
    controlConsecutivos: (() => {
      const m = readMap(json["control_consecutivos"]);
      if (!m) return null;
      return {
        documentoInicial: readString(m["documento_inicial"]),
        documentoFinal: readString(m["documento_final"]),
        totalDocumentos: readInt(m["total_documentos"]),
        documentosEsperados: readInt(m["documentos_esperados"]),
        secuenciaCompleta: readBool(m["secuencia_completa"]),
        numerosFaltantes: readStringList(m["numeros_faltantes"]),
        alertaConsecutivos: readBool(m["alerta_consecutivos"]),
        mensajeAlerta: readString(m["mensaje_alerta"]),
      } as ZReportConsecutiveControl;
    })(),
    reporteZ: Object.keys(reporteZJson).length > 0 ? {
      nroControlInicial: readString(reporteZJson["NroControl_Inicial"]),
      nroControlFinal: readString(reporteZJson["NroControl_Final"]),
      totalFacturas: readInt(reporteZJson["total_facturas"]),
      ventaBase: readString(reporteZJson["venta_base"]),
      ventaIva: readString(reporteZJson["venta_iva"]),
      totalVenta: readString(reporteZJson["total_venta"]),
      devolBase: readString(reporteZJson["devol_base"]),
      devolIva: readString(reporteZJson["devol_iva"]),
      totalDevol: readString(reporteZJson["total_devol"]),
      totalIgtf: readString(reporteZJson["total_igtf"]),
      totalZ: readString(reporteZJson["Total_z"] || reporteZJson["total_z"]),
      total: readString(reporteZJson["Total"] || reporteZJson["total"]),
      difZ: readString(reporteZJson["dif_z"]),
    } as ZReportSummary : null,
    anulacionesOtrosDias: (() => {
      const m = readMap(json["anulaciones_otros_dias"]);
      if (!m) return null;
      return {
        base: readString(m["base"]),
        iva: readString(m["iva"]),
        total: readString(m["total"]),
        cantidad: readInt(m["cantidad"]),
      } as ZReportOtherDayCancellations;
    })(),
    sucursal: readString(json["sucursal"]),
    fecha: readString(json["fecha"]),
    caja: parseCashRegister(json["caja"]),
    fondoInicial: parseAmount(json["fondo_inicial"]),
    fondoFinal: parseAmount(json["fondo_final"]),
    totalVentas: parseAmount(json["total_ventas"]),
    totalGastos: parseAmount(json["total_gastos"]),
    totalRetirado: parseAmount(json["total_retirado"]),
    diferenciaAcumulada: parseAmount(json["diferencia_acumulada"]),
    cantidadTurnos: readInt(json["cantidad_turnos"]),
    detalleSesiones: readSessions(json["detalle_sesiones"]),
  };
}

export const fiscalZReportService = {
  async fetchZReport(params: {
    date: string;
    idPharmacy: string;
    rif: string;
    entidad?: string;
    sucursa?: string;
  }): Promise<ZReportResult> {
    try {
      const queryParams: Record<string, string> = {
        fecha: params.date,
        rif: params.rif.trim(),
        id_pharmacy: params.idPharmacy.trim(),
        entidad: params.entidad || "SMART",
      };
      if (params.sucursa?.trim()) {
        queryParams["sucursa"] = params.sucursa.trim();
      }

      const response = await api.get("/admin/Facturacion/reporte_z", {
        params: queryParams,
      });

      const rawData = response.data;
      const normalized = (rawData && typeof rawData === "object" && !Array.isArray(rawData))
        ? (rawData as Record<string, unknown>)
        : {};

      const dataJson = readMap(normalized["data"]) || {};
      const fallbackData = Object.keys(dataJson).length > 0 ? dataJson : normalized;

      const reportData = Object.keys(fallbackData).length > 0
        ? parseReportData(fallbackData as Record<string, unknown>)
        : null;

      const report: ZReportResponse | null = reportData ? { data: reportData } : null;

      return {
        success: true,
        statusCode: response.status,
        message: "Reporte Z generado correctamente",
        report,
        rawPayloadJson: JSON.stringify(rawData),
        details: null,
      };
    } catch (e: any) {
      const status = e.response?.status || 0;
      const rawData = e.response?.data;

      let message = e.message || "No se pudo generar el reporte Z";

      if (typeof rawData === "string") {
        const trimmed = rawData.trim();
        const match = trimmed.match(/Internal\(["']([^"']+)["']\)/);
        if (match) {
          message = match[1];
        } else if (trimmed) {
          message = trimmed;
        }
      } else if (rawData && typeof rawData === "object") {
        message = rawData.message || rawData.error || message;
      }

      let details: string | null = null;
      if (rawData != null) {
        details = typeof rawData === "string" ? rawData : JSON.stringify(rawData);
      }

      return {
        success: false,
        statusCode: status,
        message,
        report: null,
        rawPayloadJson: null,
        details,
      };
    }
  },
};
