import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuoteLines,
  buildQuoteTotals,
  formatQuoteDate,
} from "../modules/cash-register/lib/quote-pdf.ts";

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const RATE = 42.5;

const doc = {
  header: { name: "Farmacia X", rif: "J-1", address: "Av", phone: "0212" },
  client: { name: "Cliente", documento: "V-1", direccion: "", phone: "" },
  items: [
    { name: "Med A", quantity: 2, price: 10, vat: 16 },
    { name: "Med B", quantity: 1, price: 5, vat: 0 },
  ],
  rate: RATE,
  quoteNumber: "COT-x-1",
  date: "2026-10-29T12:00:00.000Z",
};

test("buildQuoteTotals: totalBs es la suma de lineas fiscales", () => {
  const t = buildQuoteTotals(doc);
  // Med A: r2(2 * r2(10*42.5)) = 850 ; Med B: 212.5
  assert.ok(close(t.totalBs, 1062.5));
});

test("buildQuoteTotals: IVA 16% separado de la base y exento", () => {
  const t = buildQuoteTotals(doc);
  // vatBs de Med A = r2(850*16/116) = 117.24
  assert.ok(close(t.totalVatBs, 117.24));
  assert.ok(close(t.vatByRateBs[16], 117.24));
  assert.ok(close(t.exemptTotalBs, 212.5));
  assert.ok(close(t.taxableBaseBs, 732.76));
});

test("buildQuoteTotals: totalUsd deriva de la tasa CONGELADA (no en vivo)", () => {
  const t = buildQuoteTotals(doc);
  assert.equal(t.rate, RATE);
  assert.ok(close(t.totalUsd, 25)); // 1062.5 / 42.5
});

test("buildQuoteLines: precio unitario USD y total de linea fiscal en Bs", () => {
  const lines = buildQuoteLines(doc);
  assert.equal(lines.length, 2);
  assert.ok(close(lines[0].lineBs, 850));
  assert.ok(close(lines[0].lineUsd, 20));
  assert.ok(close(lines[0].unitPriceUsd, 10));
  assert.ok(close(lines[0].vatBs, 117.24));
  assert.ok(close(lines[1].lineBs, 212.5));
  assert.ok(close(lines[1].vatBs, 0));
});

test("buildQuoteLines: total de linea usa doble redondeo (r2(qty * r2(price*rate)))", () => {
  const odd = {
    ...doc,
    items: [{ name: "O", quantity: 3, price: 1.111, vat: 0 }],
  };
  const lines = buildQuoteLines(odd);
  // r2(1.111*42.5)=r2(47.2175)=47.22 ; r2(3*47.22)=141.66
  assert.ok(close(lines[0].lineBs, 141.66));
});

test("formatQuoteDate: ISO se formatea; entrada invalida se devuelve tal cual", () => {
  assert.equal(formatQuoteDate("not-a-date"), "not-a-date");
  const formatted = formatQuoteDate("2026-10-29T12:00:00.000Z");
  assert.ok(formatted.length > 0);
  assert.notEqual(formatted, "2026-10-29T12:00:00.000Z");
});
