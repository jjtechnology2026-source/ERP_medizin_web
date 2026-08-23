import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFiscalPayload,
  computeFiscalItemsExpectedTotal,
} from "../modules/cash-register/lib/fiscal-payload.ts";

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
