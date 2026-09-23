// Totales fiscales del carrito, SIEMPRE en Bs y con la misma matematica que el
// servicio/impresora fiscal: precio unitario redondeado a 2 decimales, total de
// linea redondeado a 2 decimales, y suma de lineas. Es la fuente unica que
// consume el "Resumen Fiscal" (PaymentDialog) y CheckoutBar; el USD que se
// muestra es presentacion derivada (bs / tasa). Ver money.ts fiscalLineTotalBs.

import { toBs2, fiscalLineTotalBs } from "./money.ts";

export interface FiscalMedication {
  price: number;
  quantity: number;
  vat?: number;
}

export interface FiscalTotals {
  /** Total del carrito en Bs (suma de lineas fiscales). */
  totalBs: number;
  /** IVA total en Bs. */
  totalVatBs: number;
  /** Monto exento en Bs (lineas con IVA 0). */
  exemptTotalBs: number;
  /** Base imponible en Bs (lineas gravadas, sin IVA). */
  taxableBaseBs: number;
  /** IVA en Bs agrupado por alicuota. */
  vatByRateBs: Record<number, number>;
  itemCount: number;
}

export function computeFiscalTotals(
  medications: FiscalMedication[],
  rate: number,
): FiscalTotals {
  let totalBs = 0;
  let totalVatBs = 0;
  let exemptTotalBs = 0;
  let taxableBaseBs = 0;
  let itemCount = 0;
  const vatByRateBs: Record<number, number> = {};

  for (const med of medications) {
    const vat = med.vat ?? 0;
    const lineBs = fiscalLineTotalBs(med.price, med.quantity, rate);
    const taxBs = toBs2((lineBs * vat) / (100 + vat));

    totalBs += lineBs;
    totalVatBs += taxBs;
    itemCount += med.quantity;

    if (vat === 0) {
      exemptTotalBs += lineBs;
    } else {
      taxableBaseBs += toBs2(lineBs - taxBs);
      vatByRateBs[vat] = toBs2((vatByRateBs[vat] || 0) + taxBs);
    }
  }

  return {
    totalBs: toBs2(totalBs),
    totalVatBs: toBs2(totalVatBs),
    exemptTotalBs: toBs2(exemptTotalBs),
    taxableBaseBs: toBs2(taxableBaseBs),
    vatByRateBs,
    itemCount,
  };
}
