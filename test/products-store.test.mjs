/**
 * Store-level tests for the `saveMedicine` seam in products.store.ts.
 *
 * These drive the REAL zustand store (`useProductsStore`) with the real auth
 * store, replacing only the HTTP service and the MQTT singleton with mutable
 * fixtures. That exercises: server-side existence resolution, strict rethrow,
 * optimistic revert on failure, echo-stamp behavior and `mergeEcho` synergy.
 *
 * Run: npm run test:store
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  productsService,
  resetProductsServiceMock,
} from "./fixtures/products-service-mock.mjs";
import { useAuthStore } from "../modules/auth/store/useAuthStore.ts";
import { useProductsStore } from "../modules/products/store/products.store.ts";
import { mergeEcho } from "../modules/products/lib/inventory-write.ts";

const PHARMACY_ID = "PH-1";

const SERVER_EXISTING = {
  brand: "Genérico",
  activeIngredient: "Ibuprofeno",
  dosage: "400mg",
  tablets: "20",
  barCode: "B1",
  name: "Ibuprofeno 400",
  image: "",
  category: "General",
  subcategory: "Varios",
  price: 1500,
  quantity: 10,
  stock: 10,
  description: "",
  controlled: false,
  vat: 0,
  antibiotic: false,
  minimum: 2,
  discount: 10,
  basePrice: 1200,
  profitPercentage: 25,
};

function inventoryPage(medications) {
  return {
    medications,
    next_cursor: null,
    has_more: false,
    total: medications.length,
    lowStockCount: 0,
  };
}

/** Install a getCursorInventory stub: search returns `serverResults`, resumen returns empty. */
function stubServerInventory(serverResults, opts = {}) {
  const calls = [];
  productsService.getCursorInventory = async (pharmacyId, request = {}) => {
    calls.push({ pharmacyId, request });
    if (request.resumen) return inventoryPage([]);
    if (opts.throwOnSearch) throw new Error("inventory search failed");
    return inventoryPage(serverResults);
  };
  return calls;
}

function resetStores() {
  resetProductsServiceMock();
  useAuthStore.setState({
    profile: { id: "agent-1", name: "Test", email: "t@t", role: "admin", permits: [], pharmacyId: PHARMACY_ID },
    isHydrated: true,
  });
  useProductsStore.setState({
    inventory: [],
    catalog: [],
    isLoading: false,
    isInitialLoad: false,
    hasMore: false,
    page: 1,
    inventoryTotal: null,
    lowStockCount: null,
    error: null,
    filter: "GENERAL",
    stockFilter: null,
    searchQuery: "",
    editMode: false,
    currentMedicine: null,
    lastPharmacyId: null,
    _fetchPromise: null,
    _countsPharmacyId: null,
    recentMutations: {},
  });
}

beforeEach(() => {
  resetStores();
});

// ─── 1. existing product found server-side → write fires with delta 0 ─────────

test("existing product found server-side fires the inventory write on a price-only edit", async () => {
  const calls = stubServerInventory([SERVER_EXISTING]);
  const writes = [];
  productsService.createProduct = async (m) => m;
  productsService.increaseInventory = async (pharmacyId, items) => {
    writes.push({ pharmacyId, items });
  };

  const result = await useProductsStore.getState().saveMedicine({
    ...SERVER_EXISTING,
    price: 1100,
    stock: 0,
  });

  assert.equal(result, true);
  assert.equal(writes.length, 1, "increaseInventory must fire exactly once");
  assert.equal(writes[0].pharmacyId, PHARMACY_ID);
  assert.equal(writes[0].items[0].bar_code, "B1");
  assert.equal(writes[0].items[0].stock, 0, "price-only edit writes a 0 stock delta");
  assert.equal(writes[0].items[0].price, 1100);

  const searchCall = calls.find((c) => c.request.query === "B1");
  assert.ok(searchCall, "existence must be resolved from the server inventory query");
});

// ─── 2. not on the current page but existing server-side → write fires ────────

test("product absent from the current page but existing server-side still writes (root cause B)", async () => {
  // Current page contains a different product only.
  useProductsStore.setState({ inventory: [{ ...SERVER_EXISTING, barCode: "OTHER", price: 999 }] });

  stubServerInventory([SERVER_EXISTING]);
  const writes = [];
  productsService.createProduct = async (m) => m;
  productsService.increaseInventory = async (pharmacyId, items) => {
    writes.push({ pharmacyId, items });
  };

  const result = await useProductsStore.getState().saveMedicine({
    ...SERVER_EXISTING,
    price: 1100,
    stock: 0,
  });

  assert.equal(result, true);
  assert.equal(writes.length, 1, "server-side existence must drive the write, not the page");
  assert.equal(writes[0].items[0].bar_code, "B1");
  assert.ok(
    useProductsStore.getState().inventory.some((m) => m.barCode === "B1"),
    "optimistic upsert should add the off-page product"
  );
});

// ─── 3. strict resolution rejects → no write, revert, false ──────────────────

test("a failed server resolution rethrows, writes nothing and returns false", async () => {
  const previous = [{ ...SERVER_EXISTING, barCode: "KEEP", stock: 7 }];
  useProductsStore.setState({ inventory: previous });

  stubServerInventory([], { throwOnSearch: true });
  let createCalls = 0;
  let writeCalls = 0;
  productsService.createProduct = async (m) => {
    createCalls++;
    return m;
  };
  productsService.increaseInventory = async () => {
    writeCalls++;
  };

  const result = await useProductsStore.getState().saveMedicine({
    ...SERVER_EXISTING,
    price: 1100,
    stock: 0,
  });

  assert.equal(result, false);
  assert.equal(createCalls, 0, "catalog upsert must not run after a failed resolution");
  assert.equal(writeCalls, 0, "inventory write must not run after a failed resolution");
  assert.deepEqual(useProductsStore.getState().inventory, previous, "inventory must be untouched");
});

// ─── 4. failed write does NOT stamp recentMutations (follow-up 1 fix) ─────────

test("a FAILED inventory write does not record a recent mutation", async () => {
  stubServerInventory([SERVER_EXISTING]);
  productsService.createProduct = async (m) => m;
  let writeCalls = 0;
  productsService.increaseInventory = async () => {
    writeCalls++;
    throw new Error("increaseInventory failed");
  };

  const result = await useProductsStore.getState().saveMedicine({
    ...SERVER_EXISTING,
    price: 1100,
    stock: 0,
  });

  assert.equal(result, false);
  assert.equal(writeCalls, 1, "the write must have been attempted");
  assert.deepEqual(
    useProductsStore.getState().inventory,
    [],
    "optimistic upsert must be reverted on failure"
  );
  assert.equal(
    useProductsStore.getState().recentMutations["B1"],
    undefined,
    "a failed write must not stamp recentMutations"
  );
});

// ─── 5. mergeEcho still suppresses the legitimate post-success echo ───────────

test("a successful write stamps recentMutations and mergeEcho suppresses the echo", async () => {
  stubServerInventory([SERVER_EXISTING]);
  productsService.createProduct = async (m) => m;
  productsService.increaseInventory = async () => {};

  const result = await useProductsStore.getState().saveMedicine({
    ...SERVER_EXISTING,
    stock: 5,
  });

  assert.equal(result, true);

  const state = useProductsStore.getState();
  const optimistic = state.inventory.find((m) => m.barCode === "B1");
  assert.ok(optimistic, "optimistic item should be present after a successful write");
  assert.equal(optimistic.stock, 15, "10 server stock + 5 optimistic delta");

  const lastMutationAt = state.recentMutations["B1"];
  assert.notEqual(lastMutationAt, undefined, "a successful stock write must stamp recentMutations");

  const merged = mergeEcho({
    existing: optimistic,
    incoming: { ...optimistic, stock: 5, quantity: 5 },
    lastMutationAt,
    now: lastMutationAt + 1000,
  });

  assert.equal(merged.stock, 15, "echo inside the window must not add the delta again");
});

test("mergeEcho still adds the delta outside the window (control)", async () => {
  stubServerInventory([SERVER_EXISTING]);
  productsService.createProduct = async (m) => m;
  productsService.increaseInventory = async () => {};

  await useProductsStore.getState().saveMedicine({ ...SERVER_EXISTING, stock: 5 });

  const state = useProductsStore.getState();
  const optimistic = state.inventory.find((m) => m.barCode === "B1");
  const lastMutationAt = state.recentMutations["B1"];

  const merged = mergeEcho({
    existing: optimistic,
    incoming: { ...optimistic, stock: 5, quantity: 5 },
    lastMutationAt,
    now: lastMutationAt + 5001,
  });

  assert.equal(merged.stock, 20, "outside the window the remote delta is added");
});
