// Punto de entrada del fallback "No Fiscal" por POS58 (WebUSB).
// Renderiza el comprobante (factura / nota de credito / reporte Z o X) a bytes
// ESC/POS y lo imprime en la impresora POS58. Los montos siempre llegan ya
// calculados (money.ts en el call site); aca no se recalcula nada.

import {
  buildSaleTicket,
  buildCreditNoteTicket,
  buildReportTicket,
  type SaleTicketData,
  type CreditNoteTicketData,
  type ReportTicketData,
} from "./pos58-ticket.ts";
import { printEscPos, isWebUsbSupported, pairPrinter, prepairPrinter } from "./pos58-usb.ts";

export type NoFiscalTicket =
  | ({ kind: "sale" } & SaleTicketData)
  | ({ kind: "credit-note" } & CreditNoteTicketData)
  | ({ kind: "report" } & ReportTicketData);

export interface NoFiscalPrintResult {
  printed: boolean;
  via: "usb";
  error?: string;
}

export { isWebUsbSupported, pairPrinter, prepairPrinter };

export function renderNoFiscalTicket(ticket: NoFiscalTicket): Uint8Array {
  switch (ticket.kind) {
    case "sale":
      return buildSaleTicket(ticket);
    case "credit-note":
      return buildCreditNoteTicket(ticket);
    case "report":
      return buildReportTicket(ticket);
  }
}

export async function printNoFiscalTicket(
  ticket: NoFiscalTicket,
): Promise<NoFiscalPrintResult> {
  return printEscPos(renderNoFiscalTicket(ticket));
}
