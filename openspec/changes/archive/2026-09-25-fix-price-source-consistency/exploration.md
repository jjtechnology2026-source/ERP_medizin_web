# Exploration: fix-price-source-consistency

**Change**: `fix-price-source-consistency`
**Artifact**: exploration
**Language**: English
**Repos inspected (read-only)**: `ERP_medizin_web` @ `44d5ac9` (detached HEAD), `Backend-administrativo` @ `2aa6eca7` (`dev`)
**Status**: investigation only — no source code modified.

## Summary of the Problem

The pharmacy operator reports that the stock/catalog product panel and the cash-register
(caja) show different prices for the same product (`BOTELLON DE AGUA RECARGA`), and that
price edits they make are not reflected in the register.

Two independent representations of "the price" exist for the same product, and nothing
enforces that they agree:

1. **Derived** (not a column): `sellingPrice(base_price, profit_percentage, vat)` — shown
   **only** in the product panel (`StockFeaturesForm`) as a live preview.
2. **Stored** `price` (per `pharmacy_inventory` row) — charged by the caja, shown in the
   inventory list, price-check dialog, PDF report and fiscal payload.

### Grounded number reconciliation (verified against the code)

Panel (`StockFeaturesForm`): `COSTO (SIN IVA) $0.8`, `IVA 0%`, `PRECIO FINAL Bs 1140.88`.

- `sellingPrice(0.8, 40, 0) = 0.8 / (1 − 0.40) × (1 + 0/100) = 1.33333… USD`
  (`modules/products/lib/pricing.ts:7-12`; panel preview `StockFeaturesForm.tsx:72-75`).
- `1.33333 × 855.66 Bs/USD = 1140.88 Bs` → implied rate **855.66 Bs/USD**
  (also `684.53 / 0.8 = 855.66`).

Caja ticket (`OrderItemsTable`): `CANTIDAD 1`, `EXISTENCIA 7`, `TOTAL Bs 1326.28`.

- `1326.28 / 855.66 = 1.55001 USD` → stored `price ≈ 1.55` (a round 2-decimal value).
- The caja total is `fiscalLineTotalBs(med.price, qty, rate)` = `round2(qty × price × rate)`
  (`modules/cash-register/lib/fiscal-totals.ts:42`, `lib/money.ts:14-23`) — a pure function
  of the stored `price` and the rate.

**Fingerprint match**: `1.55 = bulkSellingPrice(0.8, 40)` where `bulkSellingPrice` silently
defaults the VAT to **16 %** when none is given (`modules/products/lib/pricing.ts:40-47`,
`Math.round(sellingPrice(base, profitPct ?? 0, vatPct ?? 16) * 100) / 100`;
`round2(sellingPrice(0.8, 40, 16)) = round2(1.54666…) = 1.55`). The same convention is pinned
by an existing test (`test/pricing.test.mjs:41-46`, e.g. `bulkSellingPrice(10, 30) === 16.57`).
The panel, however, currently derives with **VAT 0 %**, producing 1.3333.

So the panel is showing a *derived preview computed with VAT 0 %* while the caja charges a
*stored price that was derived with VAT 16 %* (or, equivalently, an older cost/inputs).
The panel never displays the stored price, so the operator cannot see the value that is
actually charged.

## Current State (how the system actually works)

### 1. Exact price sources

**Caja / register — every "add product" path reads the server listing and stores the row as-is:**

- Barcode/ENTER add: `ProductSearchBar.tsx:93-113` → `findInventoryItem(code)`
  (`modules/products/store/products.store.ts:212-231`) →
  `productsService.getCursorInventory` (`modules/products/api/products.service.ts:65-104`) →
  `GET /admin/Pharmacy/{id}/medications/cursor`
  (`Backend-administrativo/.../phamacy_action/.../controllers/cursor_pharmacy_medications.rs:55-76`).
- Dropdown pick: `ProductSearchBar.tsx:70-79` (same endpoint, `query` + `limit:10`), then
  `handleSelect` → `addMedication` (`ProductSearchBar.tsx:122-133`).
- Search dialog: `ProductSearchDialog.tsx:34-39,53-56` → `searchInventory`
  (`products.store.ts:187-190`) → `loadPage` (`products.store.ts:76-125`) → same endpoint.
- Manual add: `ManualAddDialog.tsx:24,34` → `findInventoryItem`.
- The chosen object is stored unchanged: `current-order.store.ts:112-142` (`addMedication`).
- Charged as `price × qty × rate` (`fiscal-totals.ts:42`, `money.ts:21-23`);
  displayed in `OrderItemsTable.tsx:85-92` (unit price) and `:126-128` (line total),
  `EXISTENCIA` = `med.stock` (`OrderItemsTable.tsx:117-124`).

**Backend source of that row** (`phamacy_action/.../repositories.rs`):

```sql
SELECT product_id,              -- grouping key
       math::sum(stock)  AS stock,
       math::max(price)  AS price,
       math::max(base_price) AS base_price,
       math::max(profit_percentage) AS profit_percentage,
       math::max(discount), math::max(minimum), math::max(timestamp)
FROM pharmacy_inventory WHERE pharmacy_id = ... GROUP BY product_id
```
(`repositories.rs:871-881`; the fast no-filter variant `:917-931`; Rust grouping `:934-956`.)
`vat` is **not** read from inventory — it is taken from the catalog product
(`merge_inventory_with_products`, `repositories.rs:815`: `vat: product.vat as i64`).

**Stock / catalog panel — the shown price is DERIVED, never the stored `price`:**

- Opened from the inventory list: `TabInventory.tsx:81-85` `setCurrentMedicine(med)` (the
  aggregated listing row) then `setView("STOCK_FEATURES")`.
- Opened from the catalog search: `TabSearchPage.tsx:129-149` (re-reads the inventory row
  via the same cursor endpoint when the barcode already exists).
- `StockFeaturesForm.tsx:41-68` prefills `Costo (sin IVA)` from `basePrice` (or estimates it
  with `costFromPrice` when `base_price` is missing) and `Ganancia` from `profitPercentage`;
  `:72-75` computes `priceWithVat = sellingPrice(cost, profit, selectedVat)`;
  `:85-86` `finalPriceUSD/finalPriceVES`; rendered at `:276-311`.
  `currentMedicine.price` is **never rendered** in this view.

### 2. Where the divergence is introduced

There is **no writer or invariant** that keeps `pharmacy_inventory.price` equal to
`sellingPrice(base_price, profit_percentage, vat)`. In fact the three derivation inputs and
the stored price live in different places:

| Value | Storage | Written by | Read by the listing |
|---|---|---|---|
| `price` | `pharmacy_inventory` (per row) | increase / import-stock / purchase-invoices / delivery-note / batch-add | aggregated `math::max(price)` |
| `base_price`, `profit_percentage` | `pharmacy_inventory` (per row) | increase (tri-state), import-stock | aggregated `math::max(...)` |
| `vat` | `products` (catalog) | `POST /Medications/Create` only | `product_id.vat` per product |

Writers of `pharmacy_inventory.price` (backend, `file:line`):

- `medications_agent/.../infrastructure/repositories.rs:295-315` (`stock_update_set_clause`,
  `price = IF $pi > 0 THEN $pi ELSE price END`, tri-state for `base_price`/`profit_percentage`/`discount`)
- same file `:320-334` (`new_inventory_set_clause`, `price = $p{i}`)
- same file `:336-371` (`no_lote_price_propagation_sql`, `price = $pi{i}` + tri-state fields)
- same file `:1274-1291` and `:1318-1338` (Excel import-stock; `price = derived_selling_price(base, profit)`,
  no VAT, see `:114-125`)
- `phamacy_action/.../repositories.rs:735-744` (`batch_add_medications`; `price` only — **no**
  `base_price`, `profit_percentage`, `discount`)
- `purchase_invoices/.../purchase_invoices_impl.rs:125-134` (existing bucket → new lot row,
  `price = $precio`, no pricing fields) and `:156-165` (new product lot row)
- `delivery_note/.../repositories.rs:518-529` (`UPDATE ... price = IF $up > 0 ...`,
  `CREATE ... price = $cp`, no pricing fields)

Writers of `base_price`/`profit_percentage`: only the increase tri-state path
(`repositories.rs:295-371`, driven by `IncreaseMedicationItem.price_field_edits()`,
`medications_agent/.../adapters/dto.rs:32-68`) and the Excel import (`:1318-1338`).

Writers of `products.vat` (catalog): only `RepositoryProducts::create`
(`medications/.../repositories/repositories_products.rs:264-381`; INSERT `:308`, UPDATE
`:330-338` with `vat = $v{i}`). That same endpoint **silently discards** the `price`,
`basePrice` and `profitPercentage` fields the frontend sends
(`products.service.ts:106-133` sends them; `aux_to_product`/`ModelProduct` has no such
columns — see `openspec/specs/inventory-pricing-fields/spec.md:9`).

Frontend write path (single save seam): `StockFeaturesForm.tsx:96-134` builds
`price = computedPrice (derived)`, `basePrice`, `profitPercentage`, `vat`, `discount` →
`saveMedicine` (`products.store.ts:282-378`) → catalog upsert `createProduct` **plus**
`buildIncreaseItem` (`modules/products/lib/inventory-write.ts:104-143`) →
`increaseInventory` (`products.service.ts:196-201`) → `POST /admin/MedicationsAgent/increase`
(`increase_inventory.rs:66-147`). Other call sites: `useCreateProduct.ts:94-121`,
`BulkImportDialog.tsx:227-263`.

**Concrete divergence vectors (all confirmed in code):**

- **VAT is outside the pricing family.** `PricingSnapshot` has no `vat`
  (`inventory-write.ts:18-24`) and `buildIncreaseItem` never sends `vat` (`:104-143`), while
  the panel's derivation *does* use `vat` (from the catalog, `repositories.rs:815`,
  `StockFeaturesForm.tsx:74`). Changing VAT updates only the catalog and the derived preview.
- **VAT default asymmetry.** `bulkSellingPrice` defaults `vatPct ?? 16` when computing the
  price (`pricing.ts:46`) while the record's `vat` can be omitted/0
  (`BulkImportDialog.tsx:157,179`); `TabCreateProduct.tsx:275,288` does
  `parseInt(formData.vat) || 16`, coercing an explicit **0 % into 16 %** for the price math.
- **Two different "derived price" definitions.** Frontend includes VAT
  (`pricing.ts:11`); backend Excel import excludes it (`repositories.rs:114-125`).
- **Price-only writers.** purchase-invoices, delivery-note and batch-add write `price`
  without `base_price`/`profit_percentage`, so `math::max(base_price)` can come from a
  different row than `math::max(price)`.
- **Aggregation is `max`, not a single source of truth.** A price *decrease* becomes visible
  in the caja only if **every** lot row was updated (`repositories.rs:872`, `:942`).

### 3. Why "updates don't take"

The caja's add path performs a fresh server request every time — there is no client cache on
it (the products store has no `persist`; the only `products-storage` reference left is
`modules/core/utils/logout.ts:13`, a dead key with no writer; there is no react-query hook on
inventory — `@tanstack/react-query` is used only by facturas/panel/orders/marketplace).
Therefore the price the caja shows is genuinely what the backend returns. Candidate
mechanisms, each with evidence:

1. **The panel's number is not the charged number.** The operator "updates the price" by
   editing cost/profit/VAT and watching the derived preview; the preview is not the stored
   `price`, and no field in the panel shows the stored `price`.
2. **Silent no-op success.** `saveMedicine` returns `true` and the UI shows "Producto
   Agregado" while skipping `increaseInventory` when `shouldWriteInventory` is false
   (`products.store.ts:327-336`; decision table `inventory-write.ts:88-96`,
   `pricingChanged` `:71-78`). "Pricing changed" is judged against the **aggregated** server
   row; combined with `math::max(price)`, a derived value that coincides with the aggregate
   silently skips the write.
3. **Propagation is gated.** Fan-out happens only for a write with `lote == None` **and**
   `price > 0` (`repositories.rs:266-273`, gate at `:624-628`). A write that carries a lot
   (positive stock delta with the Lote field filled) or `price = 0` never propagates, and
   `math::max(price)` then keeps returning the stale higher lot price. This was explicitly
   deferred by the previous change (`archive/2026-09-25-fix-product-price-update/design.md:215-217`).
4. **Stale/foreign rows.** purchase-invoices, delivery-note and batch-add create rows whose
   `base_price`/`profit_percentage` are NULL, so the aggregate mixes inputs from different
   rows.
5. **Catalog VAT changes are not rolled back.** `saveMedicine` calls `createProduct` (catalog,
   including `vat`) *before* `increaseInventory` (`products.store.ts:300-313` then `:356-369`);
   if the inventory write fails the catalog VAT change survives, so the panel's preview
   changes while the stored price does not.

**Open question**: the exact history that produced `price = 1.55` together with
`base_price = 0.8`, `profit = 40 %`, `vat = 0 %` (i.e. whether the stored price was derived
with VAT 16 % via the bulk-import/parse default, or with an older cost such as
`sellingPrice(0.93, 40, 0) = 1.55`) cannot be proven without reading the actual
`pharmacy_inventory` and `products` rows for that barcode. Not verifiable read-only here.

### 4. Stock vs panel detail (`11` / `7Frasco` vs `EXISTENCIA 7`)

- The listing aggregates stock per product with `math::sum(stock)` across lot rows
  (`repositories.rs:872`), and the panel header/sidebar shows that aggregate
  (`StockFeaturesForm.tsx:162-165`, `:476-481`).
- **Contradiction found**: the *fast* listing (no query, no `low_stock`, no `stock_filter`,
  `repositories.rs:1318-1324`) paginates at **row level** (`START $offset LIMIT $limit`,
  `:917-931`) and only groups the fetched page in Rust (`:934-956`, `:1350-1352`). A product
  whose lot rows straddle a page boundary is returned with a **partial stock** and a
  `max(price)` computed over only the rows on that page, and can appear on two pages. The
  caja always sends a `query`, so it uses the properly grouped SQL
  (`:871-881`) — which is why the inventory screen and the caja can disagree about
  stock **and** price for multi-lot products.
- **Open question**: what the screenshot's `11` and `7Frasco` are exactly (the `7` matches
  the register's `EXISTENCIA 7`; `Frasco` appears to be a presentation/`tablets` label,
  `products.types.ts` `tablets`). The rows for that barcode are needed to decide between
  "one row with stock 7" and "lot rows straddling a page".

### 5. Relation to the just-merged `fix-product-price-update`

This is **both a consequence and a remaining gap** of that change — **not** an independent
defect.

- The prior change fixed price **propagation** on a product-level (no-lote) edit and made a
  saved price observable after reload (`openspec/specs/inventory-price-persistence`, PRs
  #24/#25/#26 FE, #57/#58 BE at `44d5ac9` / `2aa6eca7`).
- It explicitly **deferred**: backfilling already-divergent rows
  (`archive/.../design.md:215-217`), the purchase-invoice per-lot price question
  (`design.md:219-224`), and the import-stock latent divergence (`design.md:223`).
- It did **not** touch: the panel's derived display (still shows `sellingPrice`, not the
  stored price), `vat` as a pricing input, or the writers that set `price` alone
  (purchase-invoices / delivery-note / batch-add), nor the `math::max(price)` read semantics.

### 6. Reproduction path and correct/incorrect result

Deterministic reproduction of the *display* divergence (no backend needed):

- With rate `855.66` and a product whose `base_price = 0.8`, `profit_percentage = 40`,
  catalog `vat = 0`: the panel shows `1.33 USD / 1140.88 Bs`
  (`StockFeaturesForm.tsx:72-86`).
- If the same row's stored `price = 1.55`, the caja line shows
  `1326.27–1326.28 Bs` (`OrderItemsTable.tsx:126-128`, `money.ts:21-23`).
- Correct behaviour to assert: the caja's charged price and the panel's displayed price are
  the same value for the same product, and a save whose inputs change the derivation also
  changes the charged price.

Existing test surfaces:

- Frontend: `npm run test:pricing` (`test/pricing.test.mjs`, covers `sellingPrice`,
  `bulkSellingPrice` incl. the 16 % default, `taxBreakdown`), `npm run test:inventory`
  (`test/inventory-write.test.mjs`), `npm run test:store`
  (`test/products-store.test.mjs`: price-only edit writes, failed write returns false,
  echo suppression).
- Backend: real-DB E2E harness `src/http/src/price_propagation_e2e.rs` (mounts the real
  `increase` + `cursor` controllers over a scratch SurrealDB, `--ignored`), plus
  `cargo test -p medications_agent` / `-p phamacy_action` SQL-shape tests.
- **No runner currently asserts panel-vs-stored price consistency or the VAT default
  asymmetry.**

### 7. Affected code inventory and blast radius

Frontend:

- `modules/products/components/StockFeaturesForm.tsx` — derived preview + save payload
- `modules/products/lib/pricing.ts` — `sellingPrice` (with VAT) vs `bulkSellingPrice` (VAT default 16)
- `modules/products/lib/inventory-write.ts` — `PricingSnapshot` (no `vat`), `buildIncreaseItem`, `shouldWriteInventory`
- `modules/products/store/products.store.ts` — `saveMedicine`, `findInventoryItem` (fallback
  `page.medications[0]`, `:220-224`), no-op skip `:327-336`
- `modules/products/hook/useCreateProduct.ts`, `modules/products/components/BulkImportDialog.tsx`,
  `modules/products/components/TabCreateProduct.tsx` — other derivation/write sites
- `modules/cash-register/*` — `current-order.store.ts`, `fiscal-totals.ts`, `money.ts`,
  `OrderItemsTable.tsx`, `ProductSearchBar.tsx`, `ProductSearchDialog.tsx`, `ManualAddDialog.tsx`,
  `PriceCheckDialog.tsx`
- `modules/products/components/TabInventory.tsx`, `StockTaxBreakdown.tsx` — stored-price readers

Backend:

- `features/medications_agent/.../repositories.rs` (increase + import-stock + propagation)
- `features/phamacy_action/.../repositories.rs` (cursor listing, `math::max(price)`, fast path,
  batch-add)
- `features/medications/.../repositories/repositories_products.rs` (`/Medications/Create`, catalog vat)
- `features/purchase_invoices/.../purchase_invoices_impl.rs`, `features/delivery_note/.../repositories.rs`
- consumers of row-level price: `pharmacy_search/.../repositories.rs:274-285`,
  `inventory_movements`, `resumen.valor_venta` (`phamacy_action/.../repositories.rs:978-987`)

Blast-radius note: a **frontend-only** change (surface the stored price and/or warn on
mismatch) is low-risk and stops the *perception*, but it cannot reconcile the stored value or
make the caja charge the derived value. Any fix that makes `price` and
`sellingPrice(base_price, profit, vat)` a real invariant **requires the backend** and touches
increase, import-stock, purchase-invoices, delivery-note, batch-add and the listing
aggregation, plus a backfill of existing divergent rows — high blast radius.

### 8. Contradictions / gaps found

- `math::max(price)` (`repositories.rs:872`, `:942`) — the caja's price is the maximum across
  lot rows; a decrease is visible only if every row was updated. The prior change chose this
  explicitly (`design.md:13-25`).
- Fast-listing partial grouping (`repositories.rs:917-956`) — per-page stock/price for
  multi-lot products, different from the caja's grouped query (see §4).
- `resumen=true&limit=1`: `total` comes from an independent aggregate (`:1358-1399`,
  `:972-977`), so it is correct; the returned `medications` array is page-local, but the only
  consumer reads `total`/`lowStockCount` (`products.store.ts:192-210`). Low risk — it does
  confirm the fast-path partial grouping.
- Two definitions of "derived selling price": FE includes VAT (`pricing.ts:11`), backend
  Excel import does not (`repositories.rs:114-125`).
- `bulkSellingPrice` VAT default of 16 % is pinned by a test (`test/pricing.test.mjs:44`).
- `TabCreateProduct.tsx:275,288` `parseInt(formData.vat) || 16` turns an explicit `0 %` into
  `16 %`.
- `findInventoryItem` falls back to `page.medications[0]` (`products.store.ts:220-224`), so
  the `strict` existence resolution used by `saveMedicine` can return the wrong product and
  make the `pricingChanged` comparison unreliable (potential silent skip).
- `logout.ts:13` still removes a `products-storage` localStorage key that no store writes
  any more (dead reference, not a cache).

## Approaches (direction only — no implementation proposed)

1. **Surface the stored price in the panel and flag mismatches** (frontend-only).
   - Pros: smallest blast radius; immediately removes the misleading number; no backend.
   - Cons: does not reconcile data, does not make the caja charge the derived value; the
     operator still gets two numbers (now labelled).
   - Effort: Low.
2. **Make `vat` part of the pricing family and align the derivation definitions** (frontend +
   backend): carry `vat` through `PricingSnapshot`/`buildIncreaseItem`, unify the VAT default
   (`bulkSellingPrice`, `TabCreateProduct`, backend `derived_selling_price`).
   - Pros: removes the confirmed generators of the 1.55-vs-1.3333 fingerprint; keeps a single
     derivation definition.
   - Cons: touches the increase contract and several write sites; needs a decision on where
     VAT is authoritative (catalog vs per-pharmacy).
   - Effort: Medium.
3. **Enforce `price = sellingPrice(base_price, profit, vat)` as an invariant with a backfill**
   (backend-heavy).
   - Pros: eliminates the class of divergence; makes `math::max(price)` safe again.
   - Cons: highest blast radius (all price writers + listing + migration of existing divergent
     rows); requires per-lot vs product-level pricing semantics to be decided.
   - Effort: High.

## Recommendation

Proceed to proposal with a **scoped problem statement**, not a solution: the change must (a)
make the panel and the caja derive from one declared source of truth, (b) carry/reconcile
`vat` in the price family, and (c) decide the deferred purchase-invoice/per-lot semantics.
Approach 1 alone is insufficient (it hides the symptom); Approach 2 is the smallest fix that
removes the confirmed generators; Approach 3 is the only one that makes the invariant real and
should be explicitly deferred or scoped as chained follow-up work.

## Risks

- `math::max(price)` is deliberate LOT-REQ-006 semantics; changing the read path risks
  reporting regressions (`resumen.valor_venta`, movement snapshots, PDF).
- Any VAT-authority decision changes stored prices for existing multi-lot products; a
  backfill must be reversible and rehearsed on a snapshot.
- The repos are in active use by a running E2E process; backend changes must not assume a
  clean working tree, and the frontend is on a detached HEAD.
- Existing tests encode the current VAT default (`test/pricing.test.mjs:44`); changing it is a
  deliberate, visible contract change.

## Open Questions

1. Which row(s) exist for `BOTELLON DE AGUA RECARGA` (`price`, `base_price`,
   `profit_percentage`, `lote`, `vat`) — needed to close the provenance question in §3.
2. Is VAT authoritative per pharmacy (inventory) or per catalog product? Today it is catalog-only
   and never travels with the inventory price write.
3. Should the stored price be derived by the backend on every pricing write (single source of
   truth) or kept as an explicit operator-entered value?
4. Do purchase-invoice / delivery-note lot prices represent product-level intent (the previous
   design's open question, `design.md:224`) or genuine per-lot costs?
5. What exactly are the `11` and `7Frasco` in the panel screenshot (§4)?

## Ready for Proposal

Yes — with the five open questions above carried into `propose` (questions 1–3 are blocking
for the design; 4–5 are confirmable during apply/verify).
