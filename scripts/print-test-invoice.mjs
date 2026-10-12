// Dev tool: imprime los comprobantes "No Fiscal" de prueba en la POS58 USB
// (/dev/usb/lp0) usando los builders de produccion. Correr con:
//   node --experimental-strip-types scripts/print-test-invoice.mjs
import fs from "node:fs";
import {
  buildSaleTicket,
  buildCreditNoteTicket,
  buildReportTicket,
  fmtMoney,
  line,
  ESC,
} from "../modules/cash-register/lib/pos58-ticket.ts";

const LP = process.env.LP_DEVICE ?? "/dev/usb/lp0";
const header = { name: "DETODOFARMACY C.A", rif: "J-50843636-9" };

function nowVe() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function concat(list) {
  const total = list.reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of list) {
    out.set(b, off);
    off += b.length;
  }
  return out;
}

const gap = Uint8Array.from([...line(""), ...ESC.feed(2)]);

// --- 1) Factura ---
const items = [
  { qty: 2, description: "Paracetamol 500mg", amount: 12.0 },
  { qty: 1, description: "Ibuprofeno 400mg", amount: 8.5 },
  { qty: 1, description: "Vitamina C 1g (efervescente)", amount: 4.25 },
];
const subtotal = items.reduce((s, i) => s + i.amount, 0);
const iva = Math.round(subtotal * 0.16 * 100) / 100;
const total = Math.round((subtotal + iva) * 100) / 100;
const factura = buildSaleTicket({
  header,
  title: "COMPROBANTE NO FISCAL",
  controlNumber: "NF000000000123",
  date: nowVe(),
  customerName: "Cliente General",
  customerDoc: "V-00000000",
  items,
  totals: [
    { label: "Subtotal", amount: subtotal },
    { label: "IVA (16%)", amount: iva },
  ],
  total,
  payments: [{ label: "Efectivo Bs", amount: total }],
  legend: "NO FISCAL",
});

// --- 2) Nota de credito ---
const ncTotal = 8.5;
const nota = buildCreditNoteTicket({
  header,
  title: "NOTA DE CREDITO NO FISCAL",
  controlNumber: "NC000000000045",
  trackingId: "nf-8f3c-2026",
  date: nowVe(),
  customerName: "Cliente General",
  customerDoc: "V-00000000",
  affectedDoc: "NF000000000120",
  reason: "Devolucion de producto",
  items: [{ qty: 1, description: "Ibuprofeno 400mg", amount: ncTotal }],
  total: ncTotal,
  legend: "NO FISCAL",
});

// --- 3) Reporte Z ---
const zTotal = 8781.46;
const reporteZ = buildReportTicket({
  header,
  title: "REPORTE Z NO FISCAL",
  date: nowVe(),
  fields: [
    { label: "Nro Z", value: "#1234" },
    { label: "Serial", value: "01M24GDW0-2026-09-10-1234" },
    { label: "Documentos", value: "NF0001 a NF0089" },
    { label: "Contribuyentes", value: "87" },
    { label: "No contrib.", value: "12" },
    { label: "Tasa USD", value: "771,0714" },
  ],
  totals: [{ label: "Ventas gravadas", amount: 8781.46 }],
  // Todo en Bs: lo cobrado en divisa se convierte por la tasa (10 USD x 771,0714).
  paymentBreakdown: [
    { label: "Efectivo Bs", amount: 620.0 },
    { label: "Efectivo USD (10,00 $)", amount: 7710.71 },
    { label: "Tarjeta", amount: 250.0 },
    { label: "Pago Movil", amount: 120.75 },
    { label: "Biopago", amount: 80.0 },
  ],
  total: 8781.46,
  legend: "NO FISCAL",
});

// --- 4) Reporte X ---
const reporteX = buildReportTicket({
  header,
  title: "REPORTE X NO FISCAL",
  date: nowVe(),
  fields: [
    { label: "Documentos", value: "NF0001 a NF0042" },
    { label: "Contribuyentes", value: "40" },
    { label: "No contrib.", value: "2" },
  ],
  totals: [{ label: "Ventas parciales", amount: 612.4 }],
  paymentBreakdown: [
    { label: "Efectivo Bs", amount: 300.0 },
    { label: "Tarjeta", amount: 212.4 },
    { label: "Pago Movil", amount: 100.0 },
  ],
  total: 612.4,
  legend: "NO FISCAL",
});

const payload = concat([factura, gap, nota, gap, reporteZ, gap, reporteX]);
console.log(
  `factura ${factura.length}b | NC ${nota.length}b | Z ${reporteZ.length}b | X ${reporteX.length}b | total ${payload.length} bytes (${fmtMoney(zTotal)} Bs Z)`,
);

const fd = fs.openSync(LP, "w");
try {
  fs.writeSync(fd, Buffer.from(payload));
} finally {
  fs.closeSync(fd);
}
console.log(`impreso -> ${LP}`);
