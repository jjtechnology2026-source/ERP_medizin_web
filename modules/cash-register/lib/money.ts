// Util central de dinero: el sistema fiscal maneja montos en bolivares con
// EXACTAMENTE 2 decimales. Toda construccion de precios/importes que se envia
// al servicio fiscal y toda comparacion de totales pasa por aqui para evitar
// deriva de flotantes y descuadres con lo que imprime la maquina.

export function toBs2(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

// Precio unitario en Bs tal como lo recibe la maquina fiscal: el catalogo esta
// en USD y el servicio fiscal maneja Bs con EXACTAMENTE 2 decimales.
export function fiscalUnitPriceBs(priceUsd: number, rate: number): number {
  return toBs2(priceUsd * rate);
}

// Total de linea tal como lo totaliza la maquina: primero redondea el precio
// unitario en Bs y recien entonces multiplica por la cantidad. Es la fuente
// unica que deben usar resumen, payload fiscal y comprobantes.
export function fiscalLineTotalBs(priceUsd: number, quantity: number, rate: number): number {
  return toBs2(quantity * fiscalUnitPriceBs(priceUsd, rate));
}

// Total fiscal = suma de (cantidad x precio unitario CON IVA), redondeando
// cada linea a 2 decimales y luego el acumulado. Espeja el subtotal que calcula
// el servicio (schemas.py: InvoiceRequest.subtotal / total con prices_include_tax).
// Nota: este NO es el total que imprime la maquina; ver fiscalPrinterTotal.
export function fiscalItemsTotal(
  items: Array<{ quantity: number; unit_price: number }>,
): number {
  const raw = items.reduce(
    (sum, it) => sum + toBs2(Number(it.quantity) * Number(it.unit_price)),
    0,
  );
  return toBs2(raw);
}

// Tasas de IVA por codigo fiscal (espejo de app/schemas.py: TAX_RATES).
const FISCAL_TAX_RATES: Record<string, number> = {
  EXENTO: 0,
  IVA_GENERAL: 0.16,
  IVA_REDUCIDO: 0.08,
  IVA_ADICIONAL: 0.31,
  PERCIBIDO: 0,
};

// Total tal como lo calcula la MAQUINA fiscal: por cada item,
// neto(redondeado a 2) x cantidad x (1 + tasa), donde neto = precio_con_IVA /
// (1+tasa). El servicio usa exactamente esta formula
// (app/brands/hka80/brand.py: _fiscal_total) para enviar el total al pago fiscal
// (201) y devolverlo. Validar/almacenar contra ESTE total evita el descuadre de
// 1-2 centimos que trae el desglose de IVA (y que la maquina rechazaria como NAK).
export function fiscalPrinterTotal(
  items: Array<{ quantity: number; unit_price: number; tax_code?: string }>,
): number {
  const raw = items.reduce((sum, it) => {
    const rate = FISCAL_TAX_RATES[it.tax_code ?? ""] ?? 0;
    const net = toBs2(Number(it.unit_price) / (1 + rate));
    return sum + net * Number(it.quantity) * (1 + rate);
  }, 0);
  return toBs2(raw);
}

// Compara el total impreso por el servicio fiscal contra el total esperado de la
// MAQUINA (fiscalPrinterTotal). Devuelve una nota de reconciliacion si difieren
// mas de 0.01 Bs, o null.
export function reconcileFiscalTotal(
  printed: number | string | null | undefined,
  items: Array<{ quantity: number; unit_price: number; tax_code?: string }>,
): string | null {
  const expected = fiscalPrinterTotal(items);
  const printedNum = Number(printed || 0);
  if (Math.abs(printedNum - expected) > 0.01) {
    return `[RECON-FISCAL] impreso=${printedNum.toFixed(2)} esperado=${expected.toFixed(2)}`;
  }
  return null;
}
