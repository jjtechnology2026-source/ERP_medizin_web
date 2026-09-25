import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldWriteInventory,
  buildIncreaseItem,
  mergeEcho,
  ECHO_WINDOW_MS,
} from "../modules/products/lib/inventory-write.ts";

// Server-resolved existing item used as the comparison baseline.
const existing = {
  price: 1500,
  minimum: 2,
  discount: 10,
  basePrice: 1200,
  profitPercentage: 25,
};

// ─── shouldWriteInventory: saveMedicine decision table (found) ────────────────

test("price-only edit with zero stock delta writes (existing product)", () => {
  assert.equal(
    shouldWriteInventory({
      stockDelta: 0,
      submitted: { ...existing, price: 1100 },
      existing,
    }),
    true
  );
});

test("minimum-only edit on existing product writes (W1)", () => {
  assert.equal(
    shouldWriteInventory({
      stockDelta: 0,
      submitted: { ...existing, minimum: 5 },
      existing,
    }),
    true
  );
});

test("discount-only edit on existing product writes", () => {
  assert.equal(
    shouldWriteInventory({
      stockDelta: 0,
      submitted: { ...existing, discount: 15 },
      existing,
    }),
    true
  );
});

test("base-price-only edit on existing product writes", () => {
  assert.equal(
    shouldWriteInventory({
      stockDelta: 0,
      submitted: { ...existing, basePrice: 1000 },
      existing,
    }),
    true
  );
});

test("profit-percentage-only edit on existing product writes", () => {
  assert.equal(
    shouldWriteInventory({
      stockDelta: 0,
      submitted: { ...existing, profitPercentage: 30 },
      existing,
    }),
    true
  );
});

test("positive stock delta writes even with no pricing change", () => {
  assert.equal(
    shouldWriteInventory({ stockDelta: 5, submitted: existing, existing }),
    true
  );
});

test("lot-only edit (zero delta, no pricing change) skips", () => {
  assert.equal(
    shouldWriteInventory({
      stockDelta: 0,
      submitted: { ...existing, lote: "L-2026-01", fechaVencimiento: "2026-01-01" },
      existing,
    }),
    false
  );
});

test("pure no-op skips (zero delta, no pricing change)", () => {
  assert.equal(
    shouldWriteInventory({ stockDelta: 0, submitted: existing, existing }),
    false
  );
});

// ─── shouldWriteInventory: genuinely new product (missing) ────────────────────

test("genuinely new product with a positive price writes", () => {
  assert.equal(
    shouldWriteInventory({ stockDelta: 0, submitted: { price: 1500 }, existing: null }),
    true
  );
});

test("genuinely new product with minimum-only (>0) writes", () => {
  assert.equal(
    shouldWriteInventory({ stockDelta: 0, submitted: { price: 0, minimum: 3 }, existing: null }),
    true
  );
});

test("genuinely new product with positive stock writes", () => {
  assert.equal(
    shouldWriteInventory({ stockDelta: 4, submitted: {}, existing: null }),
    true
  );
});

test("genuinely new product with neither stock nor pricing skips", () => {
  assert.equal(
    shouldWriteInventory({ stockDelta: 0, submitted: {}, existing: null }),
    false
  );
  assert.equal(
    shouldWriteInventory({ stockDelta: 0, submitted: { price: 0, minimum: 0 }, existing: null }),
    false
  );
});

// ─── buildIncreaseItem ────────────────────────────────────────────────────────

const med = { barCode: "B-1", price: 1100, minimum: 0, stock: 5, quantity: 5 };

test("buildIncreaseItem keeps stock as an additive delta", () => {
  const item = buildIncreaseItem({ ...med, stock: 5 }, 5);
  assert.equal(item.stock, 5);
});

test("buildIncreaseItem forwards pricing fields and conditional optionals", () => {
  const item = buildIncreaseItem(
    {
      ...med,
      price: 1100,
      minimum: 4,
      discount: 5,
      basePrice: 1000,
      profitPercentage: 20,
    },
    0
  );
  assert.equal(item.price, 1100);
  assert.equal(item.minimum, 4);
  assert.equal(item.discount, 5);
  assert.equal(item.base_price, 1000);
  assert.equal(item.profit_percentage, 20);
});

test("buildIncreaseItem omits lote and expiry when stock delta is 0", () => {
  const item = buildIncreaseItem(
    { ...med, stock: 0, lote: " L-1 ", fechaVencimiento: " 2026-01-01 " },
    0
  );
  assert.equal("lote" in item, false);
  assert.equal("fecha_vencimiento_lote" in item, false);
});

test("buildIncreaseItem trims and forwards lote and expiry when delta > 0", () => {
  const item = buildIncreaseItem(
    { ...med, lote: " L-1 ", fechaVencimiento: " 2026-01-01 " },
    3
  );
  assert.equal(item.lote, "L-1");
  assert.equal(item.fecha_vencimiento_lote, "2026-01-01");
});

// ─── mergeEcho: realtime echo reconciliation (5s window) ─────────────────────

const echoBase = { barCode: "B-1", price: 1500, stock: 10, quantity: 10 };

test("ECHO_WINDOW_MS is 5000", () => {
  assert.equal(ECHO_WINDOW_MS, 5000);
});

test("echo within the 5s window does not add stock again", () => {
  const merged = mergeEcho({
    existing: { ...echoBase, stock: 15 },
    incoming: { ...echoBase, stock: 5, quantity: 5, price: 1100 },
    lastMutationAt: 1000,
    now: 1000 + 4999,
  });
  assert.equal(merged.stock, 15);
  assert.equal(merged.price, 1100);
});

test("echo at the 5s boundary is still treated as an echo (<=)", () => {
  const merged = mergeEcho({
    existing: { ...echoBase, stock: 15 },
    incoming: { ...echoBase, stock: 5, quantity: 5 },
    lastMutationAt: 1000,
    now: 1000 + ECHO_WINDOW_MS,
  });
  assert.equal(merged.stock, 15);
});

test("echo outside the 5s window adds the remote stock delta", () => {
  const merged = mergeEcho({
    existing: { ...echoBase, stock: 10 },
    incoming: { ...echoBase, stock: 5, quantity: 5 },
    lastMutationAt: 1000,
    now: 1000 + ECHO_WINDOW_MS + 1,
  });
  assert.equal(merged.stock, 15);
});

test("no recorded mutation adds stock (no optimistic delta)", () => {
  const merged = mergeEcho({
    existing: { ...echoBase, stock: 10 },
    incoming: { ...echoBase, stock: 5, quantity: 5 },
    now: 7000,
  });
  assert.equal(merged.stock, 15);
});

test("echo keeps the optimistic stock while applying incoming price over a stale one", () => {
  const merged = mergeEcho({
    existing: { ...echoBase, stock: 15, price: 1500 },
    incoming: { ...echoBase, stock: 5, quantity: 5, price: 1100 },
    lastMutationAt: 1000,
    now: 1200,
  });
  assert.equal(merged.stock, 15);
  assert.equal(merged.price, 1100);
});

test("mergeEcho keeps the existing price when the incoming price is zero or absent", () => {
  const merged = mergeEcho({
    existing: { ...echoBase, stock: 15, price: 1500 },
    incoming: { ...echoBase, stock: 5, quantity: 5, price: 0 },
    lastMutationAt: 1000,
    now: 1200,
  });
  assert.equal(merged.price, 1500);
  assert.equal(merged.stock, 15);
});
