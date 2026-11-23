/**
 * Resolución de un código escaneado contra el inventario de la farmacia.
 *
 * Reglas duras de `odd/tasks/barcode-scan-price.md`:
 *   - S3: si el código no corresponde a ningún producto, se dice "código no
 *     encontrado". Nunca se muestra un vecino difuso (el defecto de
 *     `products.store.ts`: `?? page.medications[0]` termina vendiendo otro
 *     producto al precio equivocado).
 *   - S7: se reintenta en orden (código tal cual, sin ceros a la izquierda,
 *     rellenado a 13) porque el backend normaliza los ceros a la izquierda de
 *     `barCode`. Cada intento se consulta y se resuelve con match exacto.
 *
 * El matcher no se reimplementa acá: sale de `resolveExactBarcode`. El acceso a
 * datos entra inyectado (`queryInventory`) para que esta lógica sea pura y se
 * pueda probar sin red ni sesión.
 */

import { barcodeAttempts, resolveExactBarcode } from "../../products/lib/barcode-resolve.ts";

/** Mínimo que se le pide a una fila de inventario: el código para matchear. */
export type ScannableRow = { barCode?: string | null };

export type ScanLookup<T> =
  | { status: "found"; product: T }
  | { status: "not-found"; code: string }
  | { status: "no-pharmacy" }
  | { status: "error"; message: string };

export interface LookupScannedCodeArgs<T extends ScannableRow> {
  /** Texto decodificado del código de barras. */
  code: string;
  /** Sucursal de la sesión (`profile.pharmacyId`); sin ella no hay inventario que consultar. */
  pharmacyId?: string | null;
  /** Ejecuta una consulta de inventario acotada a la farmacia. */
  queryInventory: (query: string) => Promise<readonly T[]>;
}

function errorMessage(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() ? message : "Error al consultar el inventario.";
}

export async function lookupScannedCode<T extends ScannableRow>(
  args: LookupScannedCodeArgs<T>,
): Promise<ScanLookup<T>> {
  const code = args.code.trim();
  const pharmacyId = args.pharmacyId?.trim();

  // Sin sucursal no se consulta nada: mostrar un precio de otra farmacia sería peor
  // que no mostrar precio.
  if (!pharmacyId) return { status: "no-pharmacy" };
  if (!code) return { status: "not-found", code };

  for (const attempt of barcodeAttempts(code)) {
    let rows: readonly T[];
    try {
      rows = await args.queryInventory(attempt);
    } catch (error) {
      return { status: "error", message: errorMessage(error) };
    }
    const hit = resolveExactBarcode(rows, attempt);
    if (hit) return { status: "found", product: hit };
  }

  return { status: "not-found", code };
}
