import { toBs2, fiscalItemsTotal, fiscalUnitPriceBs } from "./money.ts";
import { effectiveVat } from "../../products/lib/pricing.ts";

export type FiscalTaxCode = "EXENTO" | "IVA_GENERAL" | "IVA_REDUCIDO" | "IVA_ADICIONAL" | "PERCIBIDO";

export interface FiscalPayloadItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_code: FiscalTaxCode;
  sku?: string;
}

export interface FiscalPayloadPayment {
  method: "cash" | "card" | "transfer" | "mobile_payment" | "other";
  amount: number | string;
  currency?: "VES" | "USD";
  exchange_rate?: number | string;
  reference?: string;
}

export interface FiscalPayload {
  customer: { name: string; document: string; address?: string };
  items: FiscalPayloadItem[];
  payments: FiscalPayloadPayment[];
  prices_include_tax: boolean;
  dry_run: boolean;
}

const r2 = (n: number) => toBs2(n);

/** Suma que la máquina/servicio totaliza por línea (centavos por línea). */
export function computeFiscalItemsExpectedTotal(items: Array<{ quantity: number; unit_price: number }>): number {
  return fiscalItemsTotal(items);
}

/**
 * Maps a VAT percent to its fiscal tax code. Absent/undefined resolves to the
 * documented default (`effectiveVat` -> 0) so an unknown VAT is treated as
 * exempt, never fabricated as IVA_GENERAL. An explicit 0 stays EXENTO.
 */
export function mapVatToTaxCode(vat?: number | null): FiscalTaxCode {
  switch (effectiveVat(vat)) {
    case 0: return "EXENTO";
    case 8: return "IVA_REDUCIDO";
    case 31: return "IVA_ADICIONAL";
    default: return "IVA_GENERAL";
  }
}

export function mapPaymentToFiscal(p: any, rate: number): FiscalPayloadPayment {
  switch (p.method) {
    case "dollars":
      return { method: "cash" as const, amount: p.amount, currency: "USD" as const, exchange_rate: rate };
    case "card":
      return { method: "card" as const, amount: p.amount };
    case "mobile":
      return { method: "mobile_payment" as const, amount: p.amount, reference: p.reference || "" };
    case "biopago":
      return { method: "other" as const, amount: p.amount, reference: p.reference || "" };
    default:
      return { method: "cash" as const, amount: p.amount, currency: "VES" as const };
  }
}

/**
 * Los precios del catálogo están en USD e incluyen IVA; la máquina recibe
 * precio en Bs redondeado a centavos y desglosa el impuesto según tax_code.
 */
export function buildFiscalPayload(order: any): FiscalPayload {
  const rate = order.rate || 1;
  return {
    customer: {
      name: order.client?.name || "Cliente General",
      document: order.client?.documento || "V-00000000",
      address: order.client?.direccion || "",
    },
    items: order.medications.map((m: any) => ({
      description: m.name || m.description || "",
      quantity: m.quantity,
      unit_price: fiscalUnitPriceBs(m.price, rate),
      // `mapVatToTaxCode` applies the shared default: explicit 0% and an absent
      // VAT both map to EXENTO instead of a fabricated IVA_GENERAL.
      tax_code: mapVatToTaxCode(m.vat),
      sku: m.barCode || "",
    })),
    payments:
      order.payments?.length > 0
        ? order.payments.map((p: any) => mapPaymentToFiscal(p, rate))
        : [{ method: "cash", amount: r2((order.totalreal || 0) * rate), currency: "VES" }],
    prices_include_tax: true,
    dry_run: false,
  };
}
