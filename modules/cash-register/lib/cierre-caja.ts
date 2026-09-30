// Cuadre del Cierre de Caja.
//
// Un solo lugar para la matematica del cierre: el neto por metodo de pago
// (ventas menos devoluciones), la divisa neta y el saldo teorico con el que se
// calcula la diferencia. La pantalla de cierre solo compone estos numeros; no
// vuelve a sumar transacciones a mano.
//
// La matematica neta por metodo se reusa de buildZSummary (z-report.ts), que ya
// modela "bruto − devoluciones" y el neto por metodo: no se duplica aca.

import { toBs2 } from "./money.ts";
import { buildZSummary, type ZMethodLine } from "./z-report.ts";

export type CierreMethodKey = "efectivo" | "dolares" | "tarjeta" | "pagomovil" | "biopago";

const METHOD_KEYS: CierreMethodKey[] = [
  "efectivo",
  "dolares",
  "tarjeta",
  "pagomovil",
  "biopago",
];

export interface CierreTransaction {
  type?: string;
  voided?: boolean;
  currency?: string;
  amountVes?: number;
  originalAmount?: number;
  /** Metodo resuelto por el llamador (mapTransactionToMethod en la pantalla). */
  method?: CierreMethodKey | null;
}

export interface CierreBalances {
  /** Neto por metodo de pago (ventas − devoluciones), en Bs. */
  methodTotals: Record<CierreMethodKey, number>;
  /** Suma local neta de las transacciones (respaldo del saldo teorico). */
  localNetVes: number;
  /** Divisa neta (ventas − devoluciones), en USD. */
  localNetUsd: number;
  /** Saldo teorico Bs que se muestra y con el que se calcula la diferencia. */
  theoreticalBalanceVes: number;
  /** Saldo teorico USD que se muestra y con el que se calcula la diferencia. */
  theoreticalBalanceUsd: number;
}

export function emptyMethodTotals(): Record<CierreMethodKey, number> {
  return { efectivo: 0, dolares: 0, tarjeta: 0, pagomovil: 0, biopago: 0 };
}

/**
 * Separa las transacciones en ventas y devoluciones por metodo, ignorando las
 * anuladas. Es la entrada que consume buildZSummary para calcular el neto.
 */
function groupNetLines(transactions: CierreTransaction[]): {
  salesByMethod: ZMethodLine[];
  deviationsByMethod: ZMethodLine[];
} {
  const sales = new Map<CierreMethodKey, number>();
  const deviations = new Map<CierreMethodKey, number>();

  for (const tx of transactions) {
    if (tx.voided) continue;
    const method = tx.method;
    if (!method || !METHOD_KEYS.includes(method)) continue;
    const amount = toBs2(tx.amountVes ?? 0);
    if (tx.type === "refund") {
      deviations.set(method, toBs2((deviations.get(method) ?? 0) + amount));
    } else if (tx.type === "sale") {
      sales.set(method, toBs2((sales.get(method) ?? 0) + amount));
    }
    // Gastos y tipos desconocidos no entran al cuadre de caja.
  }

  return {
    salesByMethod: [...sales.entries()].map(([label, amount]) => ({ label, amount })),
    deviationsByMethod: [...deviations.entries()].map(([label, amount]) => ({ label, amount })),
  };
}

/**
 * Neto por metodo: las ventas suman y las devoluciones restan del mismo bucket.
 * Reusa la matematica neta de buildZSummary con las claves de metodo como label.
 */
export function buildMethodTotals(
  transactions: CierreTransaction[],
): Record<CierreMethodKey, number> {
  const { salesByMethod, deviationsByMethod } = groupNetLines(transactions);
  const { payments } = buildZSummary({
    invoicedTotalVes: salesByMethod.reduce((sum, line) => sum + line.amount, 0),
    salesByMethod,
    deviationsByMethod,
  });

  const totals = emptyMethodTotals();
  for (const { label, amount } of payments) {
    totals[label as CierreMethodKey] = amount;
  }
  return totals;
}

export function sumMethodTotals(totals: Record<CierreMethodKey, number>): number {
  return toBs2(Object.values(totals).reduce((sum, amount) => sum + (Number(amount) || 0), 0));
}

/**
 * Total USD neto: las ventas suman y las devoluciones restan sobre el monto
 * original en divisas, ignorando las transacciones anuladas.
 */
export function buildUsdTotal(transactions: CierreTransaction[]): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.voided) continue;
    if ((tx.currency || "").toUpperCase() !== "USD") continue;
    const sign = tx.type === "refund" ? -1 : tx.type === "sale" ? 1 : 0;
    if (sign === 0) continue;
    total += sign * (Number(tx.originalAmount) || 0);
  }
  return toBs2(total);
}

/**
 * Saldo teorico del cierre.
 *
 * La fuente autoritativa es el `saldo_teorico` que ya calcula y envia el
 * backend (apertura + ventas fiscales netas − gastos). Es exactamente lo que el
 * cierre va a persistir como base de la diferencia, por el contrato del propio
 * backend, y por eso NO se recalcula aca: el backend ya resta las notas de
 * credito.
 *
 * Solo si ese valor viene ausente o en cero Y ademas hay transacciones se cae
 * al neto local corregido (ventas − devoluciones), que usa la misma matematica
 * neta y nunca la suma aditiva vieja.
 */
export function resolveTheoreticalBalance(
  authoritative: number | null | undefined,
  fallback: number,
  hasTransactions: boolean,
): number {
  const auth = toBs2(authoritative ?? 0);
  if (hasTransactions && auth === 0) return toBs2(fallback);
  return auth;
}

/**
 * Compone el cuadre completo de la pantalla de cierre desde las transacciones:
 * neto por metodo, neto local (respaldo) y saldos teoricos autoritativos.
 */
export function buildCierreBalances(input: {
  transactions?: CierreTransaction[];
  openingAmountVes?: number;
  openingAmountUsd?: number;
  authoritativeVes?: number | null;
  authoritativeUsd?: number | null;
}): CierreBalances {
  const transactions = input.transactions ?? [];
  const methodTotals = buildMethodTotals(transactions);
  const localNetVes = sumMethodTotals(methodTotals);
  const localNetUsd = buildUsdTotal(transactions);
  const hasTransactions = transactions.some((tx) => !tx.voided);

  return {
    methodTotals,
    localNetVes,
    localNetUsd,
    theoreticalBalanceVes: resolveTheoreticalBalance(
      input.authoritativeVes,
      (input.openingAmountVes ?? 0) + localNetVes,
      hasTransactions,
    ),
    theoreticalBalanceUsd: resolveTheoreticalBalance(
      input.authoritativeUsd,
      (input.openingAmountUsd ?? 0) + localNetUsd,
      hasTransactions,
    ),
  };
}

/** Diferencia de cuadre = total fisico − saldo teorico. */
export function computeDifference(
  physicalTotal: number,
  theoreticalBalance: number,
): number {
  return toBs2((Number(physicalTotal) || 0) - (Number(theoreticalBalance) || 0));
}

export interface CierreMethodBreakdownRow {
  key: CierreMethodKey;
  /** Esperado local por metodo (ventas − devoluciones). */
  expected: number;
  /** Monto contado fisicamente para el metodo. */
  counted: number;
  /** Contado − esperado: positivo sobra, negativo falta. */
  difference: number;
}

export interface CierreMethodBreakdown {
  /** Filas con movimiento o conteo, en orden canonico de metodos. */
  rows: CierreMethodBreakdownRow[];
  /** Suma de los esperados locales (los que salen de los movimientos). */
  expectedLocalTotal: number;
  /** Saldo teorico autoritativo del backend (total fiscal). */
  authoritativeTotal: number;
  /** Autoritativo − esperado local. Distinto de cero = movimientos ≠ fiscales. */
  divergence: number;
}

/**
 * Desglose por metodo de pago del cierre.
 *
 * El esperado por metodo solo puede salir de los movimientos locales; el saldo
 * teorico autoritativo del backend es un TOTAL fiscal, no un dato por metodo.
 * Por eso `divergence` mide explicitamente la brecha entre ambos: si no es
 * cero, los movimientos de caja registrados no cuadran con los documentos
 * fiscales y la pantalla debe mostrarlo, no esconderlo.
 */
export function buildMethodBreakdown(input: {
  expectedByMethod: Record<CierreMethodKey, number>;
  countedByMethod: Record<CierreMethodKey, number>;
  authoritativeTotal: number;
}): CierreMethodBreakdown {
  const rows: CierreMethodBreakdownRow[] = [];

  for (const key of METHOD_KEYS) {
    const expected = toBs2(input.expectedByMethod?.[key] ?? 0);
    const counted = toBs2(input.countedByMethod?.[key] ?? 0);
    // Un metodo sin movimiento ni conteo no aporta nada al desglose.
    if (expected === 0 && counted === 0) continue;
    rows.push({ key, expected, counted, difference: toBs2(counted - expected) });
  }

  const expectedLocalTotal = sumMethodTotals(input.expectedByMethod);
  const authoritativeTotal = toBs2(input.authoritativeTotal);

  return {
    rows,
    expectedLocalTotal,
    authoritativeTotal,
    divergence: toBs2(authoritativeTotal - expectedLocalTotal),
  };
}

export interface FiscalResumenInput {
  baseImponibleVes?: number;
  totalExentoVes?: number;
  ivaPorcentaje?: number;
  ivaMontoVes?: number;
  totalVes?: number;
}

export interface FiscalResumen {
  taxableBase: number;
  exemptTotal: number;
  vatByRate: Record<number, number>;
  grandTotal: number;
}

/**
 * Resumen fiscal del cierre a partir de los totales fiscales YA persistidos por
 * factura (`base_imponible_ves`, `total_exento_ves`, `iva_porcentaje`,
 * `iva_monto_ves` y `total_ves`).
 *
 * No se recalcula el IVA a partir de los precios de linea: los montos
 * persistidos son la verdad fiscal. Una factura sin datos fiscales aporta cero
 * sin romper la suma.
 */
export function buildFiscalResumen(invoices: FiscalResumenInput[]): FiscalResumen {
  let taxableBase = 0;
  let exemptTotal = 0;
  let grandTotal = 0;
  const vatByRate: Record<number, number> = {};

  for (const inv of invoices) {
    const base = Number(inv.baseImponibleVes) || 0;
    const exempt = Number(inv.totalExentoVes) || 0;
    const rate = Number(inv.ivaPorcentaje) || 0;
    const iva = Number(inv.ivaMontoVes) || 0;
    const total = Number(inv.totalVes) || 0;

    taxableBase += base;
    exemptTotal += exempt;
    grandTotal += total;
    if (rate > 0) {
      vatByRate[rate] = toBs2((vatByRate[rate] ?? 0) + iva);
    }
  }

  return {
    taxableBase: toBs2(taxableBase),
    exemptTotal: toBs2(exemptTotal),
    vatByRate,
    grandTotal: toBs2(grandTotal),
  };
}
