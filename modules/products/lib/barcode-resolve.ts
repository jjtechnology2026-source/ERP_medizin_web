/**
 * Resolución de un código de barras escaneado contra las filas de inventario.
 *
 * Regla dura (spec S3 de `odd/tasks/barcode-scan-price.md`): **nunca** se devuelve
 * un producto que no corresponda al código. El POS tenía el hábito contrario en
 * `modules/products/store/products.store.ts`:
 *
 *     page.medications.find((m) => m.barCode === barCode) ?? page.medications[0]
 *
 * Con tipeo manual el fallback casi no se dispara; con un escáner sí (código de
 * góndola, etiqueta rota, producto de otra cadena) y el mostrador termina
 * vendiendo otro producto al precio equivocado. Acá no hay fallback: hay match
 * exacto o `null`.
 *
 * El orden de intentos (spec S7) existe porque el backend normaliza ceros a la
 * izquierda en `barCode` (`normalize_barcode_leading_zeros` en
 * `Backend-administrativo`): un EAN-13 escaneado puede estar guardado como UPC-A
 * de 12 dígitos, y al revés.
 */

export type BarcodeRow = { barCode?: string | null };

const DIGITS_ONLY = /^\d+$/;

/**
 * Códigos a probar, en orden de prioridad y sin repetir:
 *   1. el código tal cual se escaneó,
 *   2. sin ceros a la izquierda (si es numérico),
 *   3. rellenado con ceros a la izquierda hasta 13 (si es numérico y mide menos).
 */
export function barcodeAttempts(scanned: string): string[] {
  const code = scanned.trim();
  if (!code) return [];

  const attempts: string[] = [code];
  if (!DIGITS_ONLY.test(code)) return attempts;

  const stripped = code.replace(/^0+/, "");
  if (stripped && stripped !== code) attempts.push(stripped);

  if (code.length < 13) {
    const padded = code.padStart(13, "0");
    if (!attempts.includes(padded)) attempts.push(padded);
  }

  return attempts;
}

/**
 * Devuelve la fila cuyo `barCode` coincide exactamente con alguno de los intentos,
 * o `null`. Nunca aproxima, nunca devuelve "el primero".
 */
export function resolveExactBarcode<T extends BarcodeRow>(
  rows: readonly T[],
  scanned: string,
): T | null {
  for (const attempt of barcodeAttempts(scanned)) {
    const hit = rows.find(
      (row) => typeof row.barCode === "string" && row.barCode === attempt,
    );
    if (hit) return hit;
  }
  return null;
}
