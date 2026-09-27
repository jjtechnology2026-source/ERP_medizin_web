/**
 * Store-level tests for `products.store.ts`.
 *
 * These drive the REAL zustand store (`useProductsStore`) with the real auth
 * store, replacing only the HTTP service and the MQTT singleton with mutable
 * fixtures.
 *
 * `saveMedicine` seam: server-side existence resolution, strict rethrow,
 * optimistic revert on failure, echo-stamp behavior and `mergeEcho` synergy.
 *
 * `searchFeed` seam: the cursor-paged, self-accumulating feed behind the Caja
 * product search dialog (append-not-replace, cursor replay, retry after a failed
 * section, stale-response guard).
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
    searchFeed: {
      items: [],
      nextCursor: null,
      hasMore: false,
      isLoading: false,
      isLoadingMore: false,
      error: null,
      query: "",
      stockFilter: null,
    },
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

// ─── 6. VAT is part of the write decision (no silent skip) ────────────────────

test("a VAT-only edit on an existing product is not silently skipped", async () => {
  stubServerInventory([SERVER_EXISTING]);
  const writes = [];
  productsService.createProduct = async (m) => m;
  productsService.increaseInventory = async (pharmacyId, items) => {
    writes.push({ pharmacyId, items });
  };

  const result = await useProductsStore.getState().saveMedicine({
    ...SERVER_EXISTING,
    vat: 8,
    stock: 0,
  });

  assert.equal(result, true);
  assert.equal(writes.length, 1, "VAT-only edit must fire the write, not skip silently");
  assert.equal(writes[0].items[0].vat, 8);
});

test("a pure no-op save does not fire the inventory write (control)", async () => {
  stubServerInventory([SERVER_EXISTING]);
  let writes = 0;
  productsService.createProduct = async (m) => m;
  productsService.increaseInventory = async () => {
    writes++;
  };

  const result = await useProductsStore.getState().saveMedicine({
    ...SERVER_EXISTING,
    stock: 0,
  });

  assert.equal(result, true);
  assert.equal(writes, 0, "an unchanged save must not fire the write");
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

/* ------------------------------------------------------------------ *
 * searchFeed: accumulated, cursor-paged feed for the Caja search modal
 * ------------------------------------------------------------------ */

/** Build `count` distinct medications named "Prod N". */
function feedItems(count, from = 0) {
  return Array.from({ length: count }, (_, i) => ({
    ...SERVER_EXISTING,
    barCode: `P${from + i + 1}`,
    name: `Prod ${from + i + 1}`,
  }));
}

/**
 * Stub getCursorInventory as a paged source keyed by cursor: each call returns
 * `pageSize` items, advancing the cursor, and stops when `pages` is exhausted.
 */
function stubPagedFeed({ pages, pageSize = 20 }) {
  const calls = [];
  productsService.getCursorInventory = async (pharmacyId, request = {}) => {
    calls.push({ pharmacyId, request });
    const index = request.cursor ? Number(request.cursor) : 0;
    const medications = index < pages ? feedItems(pageSize, index * pageSize) : [];
    return {
      medications,
      next_cursor: index + 1 < pages ? String(index + 1) : null,
      has_more: index + 1 < pages,
      total: pages * pageSize,
      lowStockCount: 0,
    };
  };
  return calls;
}

test("searchFeedLoad fills the first section and records cursor/hasMore", async () => {
  const calls = stubPagedFeed({ pages: 3 });

  await useProductsStore.getState().searchFeedLoad({ query: "", stockFilter: null });

  const feed = useProductsStore.getState().searchFeed;
  assert.equal(feed.items.length, 20, "first section holds one page");
  assert.equal(feed.hasMore, true);
  assert.equal(feed.nextCursor, "1");
  assert.equal(feed.isLoading, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.limit, 20);
  assert.equal(calls[0].request.cursor, undefined, "the first section asks for no cursor");
  assert.equal(calls[0].request.query, undefined, "an empty query is not forwarded");
});

test("searchFeedNext appends and replays the cursor from the first response", async () => {
  const calls = stubPagedFeed({ pages: 3 });
  await useProductsStore.getState().searchFeedLoad({ query: "pro", stockFilter: null });

  await useProductsStore.getState().searchFeedNext();

  const feed = useProductsStore.getState().searchFeed;
  assert.equal(feed.items.length, 40, "the second section is appended, not replacing");
  assert.equal(feed.items[0].barCode, "P1", "the first section is still there");
  assert.equal(feed.items[39].barCode, "P40", "the appended rows come from the next page");
  assert.equal(feed.nextCursor, "2");
  assert.equal(feed.hasMore, true);
  assert.equal(feed.isLoadingMore, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].request.cursor, "1", "the stored next_cursor is sent back");
  assert.equal(calls[1].request.query, "pro", "the query is preserved across sections");
});

test("searchFeedNext is a no-op once hasMore is false", async () => {
  const calls = stubPagedFeed({ pages: 1 });

  await useProductsStore.getState().searchFeedLoad({ query: "", stockFilter: null });
  const loaded = calls.length;
  await useProductsStore.getState().searchFeedNext();

  assert.equal(calls.length, loaded, "no extra request past the end of the feed");
  assert.equal(useProductsStore.getState().searchFeed.hasMore, false);
});

test("a failed section keeps the loaded rows and stays retryable", async () => {
  stubPagedFeed({ pages: 3 });
  await useProductsStore.getState().searchFeedLoad({ query: "", stockFilter: null });

  productsService.getCursorInventory = async () => {
    throw new Error("network down");
  };
  await useProductsStore.getState().searchFeedNext();

  const feed = useProductsStore.getState().searchFeed;
  assert.equal(feed.items.length, 20, "already loaded rows survive the failure");
  assert.equal(feed.error, "No se pudo cargar más productos");
  assert.equal(feed.hasMore, true, "hasMore stays true so the retry can fire");
  assert.equal(feed.isLoadingMore, false, "the spinner stops after a failure");
});

test("a stale response never overwrites a newer search", async () => {
  const resolvers = [];
  productsService.getCursorInventory = (_pharmacyId, request = {}) =>
    new Promise((resolve) => resolvers.push({ request, resolve }));

  const first = useProductsStore.getState().searchFeedLoad({ query: "aspi", stockFilter: null });
  const second = useProductsStore.getState().searchFeedLoad({ query: "aspirina", stockFilter: null });

  // Resolve the newest request first, then let the stale one land late.
  resolvers[1].resolve({
    medications: feedItems(3),
    next_cursor: null,
    has_more: false,
    total: 3,
    lowStockCount: 0,
  });
  await second;
  resolvers[0].resolve({
    medications: feedItems(40),
    next_cursor: "9",
    has_more: true,
    total: 40,
    lowStockCount: 0,
  });
  await first;

  const feed = useProductsStore.getState().searchFeed;
  assert.equal(feed.items.length, 3, "the late stale response is discarded");
  assert.equal(feed.query, "aspirina");
});

test("a section that adds no new rows ends the feed", async () => {
  stubPagedFeed({ pages: 3 });
  await useProductsStore.getState().searchFeedLoad({ query: "", stockFilter: null });

  // The backend keeps claiming there is more but repeats rows we already have.
  productsService.getCursorInventory = async () => ({
    medications: feedItems(20),
    next_cursor: "2",
    has_more: true,
    total: 20,
    lowStockCount: 0,
  });

  await useProductsStore.getState().searchFeedNext();

  const feed = useProductsStore.getState().searchFeed;
  assert.equal(feed.items.length, 20, "the repeat rows are not appended");
  assert.equal(feed.hasMore, false, "a section with nothing new stops the feed");
});

/**
 * Stub getCursorInventory as an offset-paginated source that reports `total` but
 * omits `has_more` — the shape the backend returns for offset requests.
 */
function stubOffsetInventory({ total, pageSize = 10 }) {
  const calls = [];
  productsService.getCursorInventory = async (pharmacyId, request = {}) => {
    calls.push({ pharmacyId, request });
    const offset = request.offset ?? 0;
    const count = Math.max(0, Math.min(pageSize, total - offset));
    return {
      medications: feedItems(count, offset),
      next_cursor: null,
      has_more: false,
      total,
      lowStockCount: 0,
    };
  };
  return calls;
}

test("hasMore falls back to the server total when the cursor flag is absent", async () => {
  const calls = stubOffsetInventory({ total: 22 });

  await useProductsStore.getState().searchInventory("");

  const state = useProductsStore.getState();
  assert.equal(state.inventory.length, 10);
  assert.equal(state.hasMore, true, "22 products over pages of 10 means there is a page 2");
  assert.equal(calls[0].request.offset, 0, "page 1 asks for offset 0, which the service omits");
});

test("hasMore is false once the last page is reached", async () => {
  stubOffsetInventory({ total: 22 });

  await useProductsStore.getState().searchInventory("");
  await useProductsStore.getState().setPage(2);
  await useProductsStore.getState().setPage(3);

  const state = useProductsStore.getState();
  assert.equal(state.page, 3);
  assert.equal(state.inventory.length, 2, "page 3 holds the remaining 2 products");
  assert.equal(state.hasMore, false, "nothing left after the last page");
});

test("hasMore trusts the cursor flag when the server sends one", async () => {
  productsService.getCursorInventory = async () => ({
    medications: feedItems(10),
    next_cursor: "c1",
    has_more: true,
    total: 10,
    lowStockCount: 0,
  });

  await useProductsStore.getState().searchInventory("");

  const state = useProductsStore.getState();
  assert.equal(state.hasMore, true, "an explicit has_more wins over the derived value");
  assert.equal(state.inventory.length, 10);
});

test("searchFeedReset empties the slice", async () => {
  stubPagedFeed({ pages: 3 });
  await useProductsStore.getState().searchFeedLoad({ query: "pro", stockFilter: "in" });
  assert.ok(useProductsStore.getState().searchFeed.items.length > 0);

  useProductsStore.getState().searchFeedReset();

  const feed = useProductsStore.getState().searchFeed;
  assert.deepEqual(feed.items, []);
  assert.equal(feed.hasMore, false);
  assert.equal(feed.nextCursor, null);
  assert.equal(feed.error, null);
  assert.equal(feed.query, "");
  assert.equal(feed.stockFilter, null);
});
