// Util central de dinero: el sistema fiscal maneja montos en bolivares con
// EXACTAMENTE 2 decimales. Toda construccion de precios/importes que se envia
// al servicio fiscal y toda comparacion de totales pasa por aqui para evitar
// deriva de flotantes y descuadres con lo que imprime la maquina.

export function toBs2(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

// Total fiscal = suma de (cantidad x precio unitario CON IVA), redondeando
// cada linea a 2 decimales y luego el acumulado. Espeja el subtotal que calcula
// el servicio (schemas.py: InvoiceRequest.subtotal / total con prices_include_tax).
export function fiscalItemsTotal(
  items: Array<{ quantity: number; unit_price: number }>,
): number {
  const raw = items.reduce(
    (sum, it) => sum + toBs2(Number(it.quantity) * Number(it.unit_price)),
    0,
  );
  return toBs2(raw);
}

// Compara el total impreso por el servicio fiscal contra el total esperado del
// ERP. Devuelve una nota de reconciliacion si difieren mas de 0.01 Bs, o null.
export function reconcileFiscalTotal(
  printed: number | string | null | undefined,
  items: Array<{ quantity: number; unit_price: number }>,
): string | null {
  const expected = fiscalItemsTotal(items);
  const printedNum = Number(printed || 0);
  if (Math.abs(printedNum - expected) > 0.01) {
    return `[RECON-FISCAL] impreso=${printedNum.toFixed(2)} esperado=${expected.toFixed(2)}`;
  }
  return null;
}
