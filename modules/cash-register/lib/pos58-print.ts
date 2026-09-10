// Impresion del comprobante "No Fiscal" en 58 mm: se monta un nodo oculto con
// un @media print acotado y se dispara window.print(); si el navegador no
// ofrece impresion, se cae a jsPDF (import dinamico) con format:[58,h].
// Este modulo solo formatea texto: los montos los entrega el llamador ya
// calculados por money.ts; aqui no se recalcula nada.

import { NO_FISCAL_LEGEND } from "./fiscal-fallback.ts";

export interface NoFiscalTicketLine {
  label: string;
  value: string;
}

export interface NoFiscalTicketDoc {
  title: string;
  lines: NoFiscalTicketLine[];
  legend?: string;
}

export interface NoFiscalPrintResult {
  printed: boolean;
  via: "browser" | "jspdf";
  error?: string;
}

type JsPdfModule = typeof import("jspdf");

// Inyeccion solo para tests: por defecto se carga el jsPDF real.
export interface NoFiscalPrintDeps {
  loadJsPdf?: () => Promise<JsPdfModule>;
}

// La ultima linea SIEMPRE es la leyenda (por defecto "No Fiscal").
export function buildNoFiscalTicketLines(doc: NoFiscalTicketDoc): string[] {
  const legend = doc.legend ?? NO_FISCAL_LEGEND;
  return [
    doc.title,
    ...doc.lines.map((l) => `${l.label}: ${l.value}`),
    legend,
  ];
}

const PRINT_STYLE_ID = "no-fiscal-print-style";
const PRINT_CLASS = "no-fiscal-print";

function printViaBrowser(lines: string[]): void {
  document.getElementById(PRINT_STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    .${PRINT_CLASS} { display: none; }
    @media print {
      body > *:not(.${PRINT_CLASS}) { display: none !important; }
      .${PRINT_CLASS} {
        display: block !important;
        width: 58mm;
        margin: 0 auto;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
      }
    }`;

  const node = document.createElement("pre");
  node.className = PRINT_CLASS;
  node.textContent = lines.join("\n");

  document.body.appendChild(style);
  document.body.appendChild(node);
  try {
    window.print();
  } finally {
    node.remove();
    style.remove();
  }
}

async function printViaJsPdf(
  lines: string[],
  loadJsPdf: () => Promise<JsPdfModule>,
): Promise<void> {
  const { jsPDF } = await loadJsPdf();
  const lineHeight = 4;
  const height = Math.max(60, 10 + lines.length * lineHeight);
  const pdf = new jsPDF({ unit: "mm", format: [58, height] });
  pdf.setFont("courier", "normal");
  pdf.setFontSize(9);
  let y = 8;
  for (const line of lines) {
    pdf.text(line, 3, y);
    y += lineHeight;
  }
  pdf.save(`no-fiscal-${Date.now()}.pdf`);
}

export async function printNoFiscalTicket(
  doc: NoFiscalTicketDoc,
  deps?: NoFiscalPrintDeps,
): Promise<NoFiscalPrintResult> {
  const lines = buildNoFiscalTicketLines(doc);
  const canUseBrowser =
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof window.print === "function";

  if (canUseBrowser) {
    try {
      printViaBrowser(lines);
      return { printed: true, via: "browser" };
    } catch {
      // sin impresion de navegador: cae a jsPDF
    }
  }

  try {
    await printViaJsPdf(lines, deps?.loadJsPdf ?? (() => import("jspdf")));
    return { printed: true, via: "jspdf" };
  } catch (error) {
    return {
      printed: false,
      via: "jspdf",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
