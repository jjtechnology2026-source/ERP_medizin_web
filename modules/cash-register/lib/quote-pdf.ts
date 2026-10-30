// Generador de PDF de cotización (jsPDF, client-side). Los montos se derivan de
// la MISMA matemática fiscal (computeFiscalTotals) para que el presupuesto
// coincida con lo que la fiscal emitirá si la cotización se convierte a venta.
// El rate viene congelado desde el build de la orden (no se re-lee en vivo).

import { computeFiscalTotals } from "@/modules/cash-register/lib/fiscal-totals";

export interface QuoteHeader {
  name: string;
  rif: string;
  address: string;
  phone: string;
}

export interface QuoteClient {
  name: string;
  documento: string;
  direccion: string;
  phone: string;
}

export interface QuoteItemDraft {
  name: string;
  quantity: number;
  price: number;
  vat: number;
}

export interface QuoteDocument {
  header: QuoteHeader;
  client: QuoteClient;
  items: QuoteItemDraft[];
  rate: number;
  quoteNumber: string;
  date: string;
}

export interface QuoteLine {
  name: string;
  quantity: number;
  unitPriceUsd: number;
  lineUsd: number;
  lineBs: number;
  vat: number;
  vatBs: number;
}

export interface QuoteTotals {
  totalBs: number;
  totalVatBs: number;
  exemptTotalBs: number;
  taxableBaseBs: number;
  vatByRateBs: Record<number, number>;
  totalUsd: number;
  rate: number;
  itemCount: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const toUsd = (bs: number, rate: number) => (rate > 0 ? r2(bs / rate) : 0);

/** Líneas del presupuesto: precio unitario en USD, total de línea fiscal en Bs. */
export function buildQuoteLines(doc: QuoteDocument): QuoteLine[] {
  const rate = doc.rate > 0 ? doc.rate : 1;
  return doc.items.map((it) => {
    const lineBs = r2(it.quantity * r2(it.price * rate));
    const vat = it.vat || 0;
    const vatBs = r2((lineBs * vat) / (100 + vat));
    return {
      name: it.name || "",
      quantity: it.quantity,
      unitPriceUsd: r2(it.price),
      lineUsd: toUsd(lineBs, rate),
      lineBs,
      vat,
      vatBs,
    };
  });
}

/** Totales fiscales del presupuesto, en Bs (USD derivado con la tasa congelada). */
export function buildQuoteTotals(doc: QuoteDocument): QuoteTotals {
  const rate = doc.rate > 0 ? doc.rate : 1;
  const t = computeFiscalTotals(
    doc.items.map((it) => ({ price: it.price, quantity: it.quantity, vat: it.vat })),
    rate,
  );
  return {
    totalBs: t.totalBs,
    totalVatBs: t.totalVatBs,
    exemptTotalBs: t.exemptTotalBs,
    taxableBaseBs: t.taxableBaseBs,
    vatByRateBs: t.vatByRateBs,
    totalUsd: toUsd(t.totalBs, rate),
    rate,
    itemCount: t.itemCount,
  };
}

/** Fecha legible para el pie del presupuesto (dd/mm/aaaa). */
export function formatQuoteDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Genera y descarga el PDF de cotización. */
export async function generateQuotePdf(doc: QuoteDocument): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });

  const lines = buildQuoteLines(doc);
  const totals = buildQuoteTotals(doc);
  const width = 612; // letter, en puntos
  const margin = 40;
  const right = width - margin;

  // Encabezado: farmacia
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(doc.header.name || "Cotización", margin, 50);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`RIF: ${doc.header.rif || "-"}`, margin, 68);
  pdf.text(`Dirección: ${doc.header.address || "-"}`, margin, 80);
  pdf.text(`Teléfono: ${doc.header.phone || "-"}`, margin, 92);

  // Encabezado: documento
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("COTIZACIÓN", right, 50, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`No: ${doc.quoteNumber}`, right, 64, { align: "right" });
  pdf.text(`Fecha: ${formatQuoteDate(doc.date)}`, right, 76, { align: "right" });

  // Cliente
  let y = 118;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Cliente", margin, y);
  y += 16;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Nombre: ${doc.client.name || "-"}`, margin, y);
  y += 14;
  pdf.text(`RIF/Doc: ${doc.client.documento || "-"}`, margin, y);
  y += 14;
  pdf.text(`Dirección: ${doc.client.direccion || "-"}`, margin, y);
  y += 14;
  pdf.text(`Teléfono: ${doc.client.phone || "-"}`, margin, y);

  // Tabla de ítems
  y += 26;
  const col = { name: margin, qty: 320, unit: 372, vat: 444, total: right };
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Descripción", col.name, y);
  pdf.text("Cant.", col.qty, y);
  pdf.text("P.Unit.", col.unit, y);
  pdf.text("IVA", col.vat, y);
  pdf.text("Total", col.total, y, { align: "right" });
  y += 8;
  pdf.setDrawColor(200);
  pdf.line(margin, y, right, y);
  y += 16;

  pdf.setFont("helvetica", "normal");
  for (const line of lines) {
    if (y > 716) {
      pdf.addPage();
      y = 40;
    }
    pdf.text(line.name.slice(0, 42), col.name, y);
    pdf.text(String(line.quantity), col.qty, y);
    pdf.text(`$ ${line.unitPriceUsd.toFixed(2)}`, col.unit, y);
    pdf.text(`${line.vat}%`, col.vat, y);
    pdf.text(`$ ${line.lineUsd.toFixed(2)}`, col.total, y, { align: "right" });
    y += 14;
  }

  // Totales
  y += 18;
  const totalRow = (label: string, bs: number, usdVal: number, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(label, margin, y);
    pdf.text(`$ ${usdVal.toFixed(2)}`, col.vat, y, { align: "right" });
    pdf.text(`Bs ${bs.toFixed(2)}`, col.total, y, { align: "right" });
    y += 14;
  };

  if (totals.exemptTotalBs > 0) totalRow("Monto exento:", totals.exemptTotalBs, toUsd(totals.exemptTotalBs, totals.rate));
  if (totals.taxableBaseBs > 0) totalRow("Base imponible:", totals.taxableBaseBs, toUsd(totals.taxableBaseBs, totals.rate));
  Object.entries(totals.vatByRateBs)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([vat, bs]) => totalRow(`IVA ${vat}%:`, bs, toUsd(bs, totals.rate)));
  // Una cotización no cobra pagos en divisas: el IGTF se liquida al convertir.
  totalRow("IGTF 3%:", 0, 0);
  y += 2;
  pdf.setDrawColor(120);
  pdf.line(margin, y, right, y);
  y += 14;
  totalRow("Total:", totals.totalBs, totals.totalUsd, true);

  // Pie
  y += 8;
  pdf.setFontSize(9);
  pdf.text(`Tasa de cambio congelada: Bs ${totals.rate.toFixed(2)} por USD`, margin, y);
  y += 14;
  pdf.text("Válido por 15 días desde su emisión.", margin, y);

  pdf.save(`cotizacion_${doc.quoteNumber.replace(/[^\w-]/g, "_") || "sin_numero"}.pdf`);
}
