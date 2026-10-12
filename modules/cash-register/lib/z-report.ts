// Cuadre del Reporte Z.
//
// Un solo lugar para la matematica del Z: total facturado (bruto), devoluciones
// (notas de credito), neto y el desglose por metodo de pago, con las diferencias
// de cuadre. El ticket "No Fiscal" y el dialogo usan esto para que el Z NO se
// imprima si no cuadra ("exacto lo que se vendio").

import { toBs2 } from "./money.ts";
import { paymentLabel } from "./fiscal-fallback-flow.ts";

export interface ZMethodLine {
  label: string;
  amount: number;
}

export interface ZSummaryInput {
  /** Total facturado de la sesion (Σ facturas.total_ves), en Bs. */
  invoicedTotalVes: number;
  /** Cobros por metodo (transacciones tipo venta), en Bs. */
  salesByMethod: ZMethodLine[];
  /** Devoluciones por metodo (transacciones tipo devolucion / NC), en Bs. */
  deviationsByMethod?: ZMethodLine[];
}

export interface ZSummary {
  /** Total facturado (bruto) antes de devoluciones. */
  grossTotal: number;
  totalDeviations: number;
  /** Lo vendido neto = bruto − devoluciones. */
  netTotal: number;
  /** Cobros netos por metodo (ventas − devoluciones). */
  payments: ZMethodLine[];
  /** Σ cobros por metodo − total facturado. Debe ser 0. */
  salesDiff: number;
  /** Σ desglose neto − neto. Debe ser 0. */
  netDiff: number;
  /** true si todo cuadra dentro de la tolerancia (1 centavo). */
  ok: boolean;
  /** Lineas de cuadre para imprimir/mostrar. */
  reconciliation: ZMethodLine[];
}

const TOLERANCE = 0.01;

function sumLines(lines: ZMethodLine[]): number {
  return toBs2(lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0));
}

export function buildZSummary(input: ZSummaryInput): ZSummary {
  const salesByMethod = input.salesByMethod ?? [];
  const deviationsByMethod = input.deviationsByMethod ?? [];

  const grossTotal = toBs2(input.invoicedTotalVes || 0);
  const totalDeviations = sumLines(deviationsByMethod);
  const netTotal = toBs2(grossTotal - totalDeviations);

  const salesSum = sumLines(salesByMethod);
  const salesDiff = toBs2(salesSum - grossTotal);

  // Neto por metodo: ventas menos devoluciones del mismo metodo.
  const map = new Map<string, number>();
  for (const l of salesByMethod) {
    map.set(l.label, toBs2((map.get(l.label) ?? 0) + (Number(l.amount) || 0)));
  }
  for (const l of deviationsByMethod) {
    map.set(l.label, toBs2((map.get(l.label) ?? 0) - (Number(l.amount) || 0)));
  }
  const payments = [...map.entries()]
    .filter(([, amount]) => Math.abs(amount) > 0.0001)
    .map(([label, amount]) => ({ label, amount }));

  const netDiff = toBs2(sumLines(payments) - netTotal);

  return {
    grossTotal,
    totalDeviations,
    netTotal,
    payments,
    salesDiff,
    netDiff,
    ok: Math.abs(salesDiff) <= TOLERANCE && Math.abs(netDiff) <= TOLERANCE,
    reconciliation: [
      { label: "Cuadre ventas", amount: salesDiff },
      { label: "Cuadre neto", amount: netDiff },
    ],
  };
}

// --- Resumen de la sesion (Z y X comparten la misma matematica) ---

export interface SessionSummaryTransaction {
  type?: string;
  paymentMethod?: string;
  amountVes?: number;
}

export interface SessionSummaryInvoice {
  totalVes?: number;
}

export interface SessionSummary {
  /** Cobros por metodo (transacciones tipo venta), en Bs. */
  paymentBreakdown: ZMethodLine[];
  /** Devoluciones / notas de credito por metodo, en Bs. */
  deviationsByMethod: ZMethodLine[];
  summary: ZSummary;
}

/**
 * Arma el cuadre de la sesion desde las transacciones y facturas cargadas.
 * Lo usan el reporte Z y el X "No Fiscal": un solo lugar para que no se separen.
 */
export function buildSessionSummary(input: {
  sessionInvoices?: SessionSummaryInvoice[];
  sessionTransactions?: SessionSummaryTransaction[];
}): SessionSummary {
  const transactions = input.sessionTransactions ?? [];

  const salesMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "sale") continue;
    const label = paymentLabel(t.paymentMethod);
    salesMap.set(label, (salesMap.get(label) ?? 0) + (Number(t.amountVes) || 0));
  }

  const devMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "devolucion" && t.type !== "refund") continue;
    const label = paymentLabel(t.paymentMethod);
    devMap.set(label, (devMap.get(label) ?? 0) + (Number(t.amountVes) || 0));
  }

  const invoicedTotalVes = (input.sessionInvoices ?? []).reduce(
    (sum, inv) => sum + (Number(inv.totalVes) || 0),
    0,
  );

  const paymentBreakdown = [...salesMap.entries()].map(([label, amount]) => ({ label, amount }));
  const deviationsByMethod = [...devMap.entries()].map(([label, amount]) => ({ label, amount }));

  return {
    paymentBreakdown,
    deviationsByMethod,
    summary: buildZSummary({ invoicedTotalVes, salesByMethod: paymentBreakdown, deviationsByMethod }),
  };
}
