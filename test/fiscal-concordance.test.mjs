import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFiscalPayload,
  computeFiscalItemsExpectedTotal,
  mapVatToTaxCode,
} from "../modules/cash-register/lib/fiscal-payload.ts";
import { toBs2, fiscalItemsTotal } from "../modules/cash-register/lib/money.ts";
import { computeFiscalTotals } from "../modules/cash-register/lib/fiscal-totals.ts";

// Convención service_fiscal (schemas.py): precios incluyen IVA ->
// line_total = round2(qty * price); total = round2(sum(line_total))
const r2 = (n) => Math.round(n * 100) / 100;
function serviceTotal(items) {
  return r2(items.reduce((s, it) => s + r2(Number(it.quantity) * Number(it.unit_price)), 0));
}

// Convención BD (facturas_impl.rs): base=round2(price/(1+vat)); sub=round2(qty*base);
// total = round2(sum(sub) + sum(round2(sub*vat/100)))
function dbTotal(items) {
  let base = 0, exento = 0, iva = 0;
  for (const it of items) {
    const vat = { EXENTO: 0, IVA_REDUCIDO: 8, IVA_ADICIONAL: 31, IVA_GENERAL: 16 }[it.tax_code] ?? 16;
    const unitBase = vat > 0 ? r2(it.unit_price / (1 + vat / 100)) : it.unit_price;
    const sub = r2(it.quantity * unitBase);
    if (vat <= 0) exento += sub;
    else {
      base += sub;
      iva += r2((sub * vat) / 100);
    }
  }
  return r2(r2(base + exento + iva));
}

const RATE = 771.0714;

test("buildFiscalPayload convierte precios USD a Bs redondeados", () => {
  const payload = buildFiscalPayload({
    rate: RATE,
    client: { name: "Cliente", documento: "V123" },
    medications: [{ name: "MALTA", price: 10.44, quantity: 1, vat: 16 }],
    payments: [],
    totalreal: 10.44,
  });
  assert.equal(payload.items[0].unit_price, r2(10.44 * RATE));
  assert.equal(payload.prices_include_tax, true);
});

// Regresión independiente: la assertion lee el tax_code EMITIDO directamente y
// NO lo re-deriva (a diferencia de dbTotal, que mapea tax_code -> vat). Un `vat: 0`
// explícito debe ser EXENTO, no IVA_GENERAL; un VAT ausente cae al default efectivo 0.
test("tax_code: 0% explícito -> EXENTO y VAT ausente -> default efectivo (0 -> EXENTO)", () => {
  const payload = buildFiscalPayload({
    rate: RATE,
    client: {},
    medications: [
      { name: "cero", price: 5, quantity: 1, vat: 0 },
      { name: "ausente", price: 5, quantity: 1 },
      { name: "general", price: 5, quantity: 1, vat: 16 },
      { name: "reducido", price: 5, quantity: 1, vat: 8 },
      { name: "adicional", price: 5, quantity: 1, vat: 31 },
    ],
    payments: [],
    totalreal: 0,
  });

  assert.equal(mapVatToTaxCode(0), "EXENTO");
  assert.deepEqual(
    payload.items.map((it) => it.tax_code),
    ["EXENTO", "EXENTO", "IVA_GENERAL", "IVA_REDUCIDO", "IVA_ADICIONAL"],
  );
  assert.equal(
    payload.items[1].tax_code,
    payload.items[0].tax_code,
    "un VAT ausente debe resolver al mismo default efectivo que 0%",
  );
});

// El default 0 vive en mapVatToTaxCode: un VAT ausente/null nunca debe fabricar
// IVA_GENERAL (16). Cubre también los call sites que delegan en este helper.
test("mapVatToTaxCode: ausente/null -> EXENTO (default 0), nunca IVA_GENERAL", () => {
  assert.equal(mapVatToTaxCode(0), "EXENTO");
  assert.equal(mapVatToTaxCode(undefined), "EXENTO");
  assert.equal(mapVatToTaxCode(null), "EXENTO");
  assert.equal(mapVatToTaxCode(NaN), "EXENTO");
  assert.equal(mapVatToTaxCode(8), "IVA_REDUCIDO");
  assert.equal(mapVatToTaxCode(16), "IVA_GENERAL");
  assert.equal(mapVatToTaxCode(31), "IVA_ADICIONAL");
});

test("concordancia: total máquina == esperado por línea (carrito mixto)", () => {
  const order = {
    rate: RATE,
    client: { name: "Cliente", documento: "V123" },
    medications: [
      { name: "A", price: 10.44, quantity: 1, vat: 16 },
      { name: "B", price: 3.33, quantity: 3, vat: 8 },
      { name: "C", price: 5.0, quantity: 2, vat: 0 },
      { name: "D", price: 7.89, quantity: 1.5, vat: 16 },
    ],
    payments: [],
    totalreal: 39.165,
  };
  const payload = buildFiscalPayload(order);
  const expected = computeFiscalItemsExpectedTotal(payload.items);
  assert.equal(serviceTotal(payload.items), expected);
});

test("concordancia: total impreso vs total BD dentro de 1 centavo por unidad", () => {
  // ponytail: la máquina ancla round2(cant×precio_bruto) y la BD hace
  // triple redondeo sobre base por unidad -> deriva <= 0.01×Σcantidades.
  // Eliminarla del todo exige que el backend genere el payload fiscal
  // desde el mismo cálculo del total (fuente única).
  const orders = [
    [{ price: 10.44, quantity: 1, vat: 16 }, { price: 3.33, quantity: 3, vat: 8 }],
    [{ price: 5.0, quantity: 2, vat: 0 }, { price: 7.89, quantity: 1.5, vat: 16 }],
    [{ price: 0.99, quantity: 7, vat: 31 }],
    [{ price: 12.34, quantity: 2, vat: 16 }, { price: 1.11, quantity: 4, vat: 8 }, { price: 9.99, quantity: 1, vat: 0 }],
  ];
  for (const meds of orders) {
    const payload = buildFiscalPayload({ rate: RATE, medications: meds, payments: [], totalreal: 0 });
    const printed = computeFiscalItemsExpectedTotal(payload.items);
    const stored = dbTotal(payload.items);
    const units = meds.reduce((s, m) => s + m.quantity, 0);
    assert.ok(
      Math.abs(printed - stored) <= 0.01 * units,
      `impreso ${printed} vs bd ${stored} (unidades ${units})`
    );
  }
});

test("concordancia exacta: líneas de cantidad 1 coinciden a 1 centavo", () => {
  for (const [price, vat] of [[10.44, 16], [3.33, 8], [5.0, 0], [0.99, 31]]) {
    const payload = buildFiscalPayload({ rate: RATE, medications: [{ price, quantity: 1, vat }], payments: [], totalreal: 0 });
    const printed = computeFiscalItemsExpectedTotal(payload.items);
    const stored = dbTotal(payload.items);
    assert.ok(Math.abs(printed - stored) <= 0.01, `${price}/${vat}%: ${printed} vs ${stored}`);
  }
});

test("fallback de pago único en VES usa totalreal convertido", () => {
  const payload = buildFiscalPayload({
    rate: RATE,
    client: {},
    medications: [{ name: "X", price: 1, quantity: 1, vat: 16 }],
    payments: [],
    totalreal: 2.5,
  });
  assert.deepEqual(payload.payments, [
    { method: "cash", amount: r2(2.5 * RATE), currency: "VES" },
  ]);
});

// El servicio fiscal usa ROUND_HALF_UP (Decimal). toBs2 debe coincidir
// EXACTAMENTE; el round() builtin de Python es banker's rounding y da 0.01 de
// diferencia (9125.625 -> 9125.62 vs 9125.63). Este test clava el comportamiento.
test("toBs2 redondea half-up (no banker's rounding)", () => {
  assert.equal(toBs2(9125.625), 9125.63);
  assert.equal(toBs2(0.005), 0.01);
  assert.equal(toBs2(2.675), 2.68);
  assert.equal(toBs2(10.44 * RATE), r2(10.44 * RATE));
});

test("fiscalItemsTotal replica subtotal del servicio (round2 por linea + round2 suma)", () => {
  const items = [
    { quantity: 1, unit_price: r2(10.44 * RATE) },
    { quantity: 3, unit_price: r2(3.33 * RATE) },
    { quantity: 2, unit_price: r2(5.0 * RATE) },
    { quantity: 1.5, unit_price: r2(7.89 * RATE) },
  ];
  const ups = Object.fromEntries(items.map((it, i) => [i, it.unit_price]));
  const expected = r2(items.reduce((s, it, i) => s + r2(it.quantity * ups[i]), 0));
  assert.equal(fiscalItemsTotal(items), expected);
  assert.equal(serviceTotal(items), expected);
});

// Regresión del "Resumen Fiscal": con un precio derivado sin redondear
// (costo 1.25, ganancia 40%, IVA 0% -> 1.25/0.6 = 2.0833...), la fila "Total"
// mostraba Bs 1775.28 mientras "Total a cobrar" cobraba Bs 1778.12. La causa era
// redondear el USD por línea antes de aplicar la tasa. El agregado canónico
// (computeFiscalTotals) debe salir de la MISMA matemática que la impresora.
test("resumen fiscal: agregado en Bs == total fiscal impreso (precio 2.0833...)", () => {
  const VIDEO_RATE = 853.5;
  const price = 1.25 / 0.6; // 2.0833...
  const meds = [{ price, quantity: 1, vat: 0 }];

  const t = computeFiscalTotals(meds, VIDEO_RATE);
  const items = buildFiscalPayload({ rate: VIDEO_RATE, client: {}, medications: meds, payments: [], totalreal: price }).items;
  const oldDisplayPath = toBs2(toBs2(price) * VIDEO_RATE); // redondeo USD -> bug

  assert.equal(oldDisplayPath, 1775.28);          // el valor que se veía mal
  assert.equal(t.totalBs, fiscalItemsTotal(items)); // fuente única
  assert.notEqual(t.totalBs, oldDisplayPath);     // el bug no reaparece
  assert.equal(t.exemptTotalBs, t.totalBs);       // "Monto exento" == "Total"
});

test("resumen fiscal: base + IVA + exento == total en Bs (carrito mixto)", () => {
  const meds = [
    { price: 1.25 / 0.6, quantity: 3, vat: 0 },
    { price: 10.44, quantity: 1, vat: 16 },
    { price: 3.33, quantity: 3, vat: 8 },
  ];
  const t = computeFiscalTotals(meds, RATE);
  const items = buildFiscalPayload({ rate: RATE, client: {}, medications: meds, payments: [], totalreal: 0 }).items;

  assert.equal(t.totalBs, fiscalItemsTotal(items));
  assert.equal(toBs2(t.taxableBaseBs + t.totalVatBs + t.exemptTotalBs), t.totalBs);
});
