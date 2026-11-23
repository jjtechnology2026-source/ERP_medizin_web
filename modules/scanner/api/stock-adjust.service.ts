import api from "@/modules/core/api/client";
import {
  STOCK_ADJUST_PATH,
  adjustFailure,
  unwrapStockAdjustPayload,
  type StockAdjustOutcome,
} from "../lib/stock-adjust-contract.ts";

export interface AdjustScannedStockArgs {
  /** Sucursal de la sesión (`profile.pharmacyId`): el endpoint es por farmacia. */
  pharmacyId?: string | null;
  /**
   * Código **tal como está guardado** en el inventario (`product.barCode`). El
   * backend matchea por igualdad exacta (`bar_code = $bar`, sin normalizar ceros
   * a la izquierda), así que no sirve el texto decodificado del escáner si el
   * lookup resolvió por un reintento de S7.
   */
  barCode?: string | null;
  /** Entero distinto de cero: positivo suma, negativo resta. */
  delta: number;
  reason?: string;
}

/**
 * Ajuste de stock desde el escáner contra `POST /admin/inventory/adjust`.
 *
 * Nunca lanza: todo rechazo del contrato vuelve como `StockAdjustOutcome` con la
 * copia que la pantalla muestra al operador. El stock y el movimiento auditado
 * los escribe el backend en una sola transacción, así que acá no hay
 * compensaciones ni reintentos propios: un 409 se le informa al operador para que
 * vuelva a leer el stock.
 */
export async function adjustScannedStock(
  args: AdjustScannedStockArgs,
): Promise<StockAdjustOutcome> {
  const pharmacyId = args.pharmacyId?.trim();
  const barCode = args.barCode?.trim();
  if (!pharmacyId || !barCode) {
    return {
      status: "error",
      message: "Falta la farmacia o el código del producto para ajustar el stock.",
    };
  }
  if (!Number.isSafeInteger(args.delta) || args.delta === 0) {
    // El control ya no deja llegar acá; si llegara, no se escribe nada.
    return { status: "error", message: "La cantidad del ajuste no es válida." };
  }

  try {
    const { data } = await api.post(STOCK_ADJUST_PATH, {
      pharmacy_id: pharmacyId,
      bar_code: barCode,
      delta: args.delta,
      ...(args.reason?.trim() ? { reason: args.reason.trim() } : {}),
    });
    const result = unwrapStockAdjustPayload(data);
    if (!result) {
      // Un 200 sin `stock_nuevo` no confirma nada: se reporta como error en vez
      // de mostrar un stock que no sabemos si se aplicó.
      return {
        status: "error",
        message: "El servidor no devolvió el stock actualizado. Revisá el inventario antes de reintentar.",
      };
    }
    return { status: "adjusted", result };
  } catch (error) {
    const shaped = error as { response?: { status?: unknown; data?: unknown } } | null;
    const status = shaped?.response?.status;
    return adjustFailure(typeof status === "number" ? status : 0, shaped?.response?.data);
  }
}
