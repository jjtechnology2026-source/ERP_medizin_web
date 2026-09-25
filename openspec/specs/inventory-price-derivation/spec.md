# Inventory Price Derivation Specification

## Purpose

Enforces one authoritative price derivation on every per-pharmacy inventory pricing write: `pharmacy_inventory.price = derived(base_price, profit_percentage, effective_vat, discount)`. VAT is authoritative per pharmacy inventory with an explicit `0` preserved, and a reversible backfill reconciles existing divergent rows.

## Requirements

### Requirement: Derived Price Invariant On Every Pricing Write

The backend MUST recompute and persist `pharmacy_inventory.price = derived(base_price, profit_percentage, vat)` from that row's post-write derivation inputs on every write that changes any of `base_price`, `profit_percentage`, or `vat`. A write that changes no derivation input MUST leave `price` unchanged. A write whose inputs cannot produce a derivation (no usable `base_price`) MUST leave `price` unchanged rather than invent one. Writer coverage is enumerated in *Every Price Writer Is Covered By The Invariant*.

#### Scenario: Single-lot increase and decrease
- GIVEN one row with base_price=0.8, profit=40, vat=0 → derived price 1.33
- WHEN a write raises the derived price to 1.55, then lowers it to 1.20
- THEN the persisted price is 1.55 then 1.20 after each write

#### Scenario: Multi-lot increase and decrease
- GIVEN a product whose lot rows hold prices that differ from derived
- WHEN a pricing write targets the product
- THEN every affected row's persisted price equals that row's derived value

#### Scenario: USD and Bs agree
- GIVEN a persisted price in USD and the current rate
- WHEN the register charges and the panel displays the same product
- THEN both show `round2(price * rate)` Bs and the USD value `price`

#### Scenario: Absent inputs preserve (not invent)
- GIVEN a row whose base_price is NULL
- WHEN a pricing write omits base_price
- THEN price is unchanged and no error is raised

#### Scenario: Invalid profit rejected
- GIVEN a profit_percentage >= 100 or non-finite
- WHEN a pricing write is requested
- THEN the write fails and no price is persisted

### Requirement: One Authoritative Derivation Formula

The system MUST define exactly one derivation: `derived(base, profit, vat) = round2((base / (1 - profit/100)) * (1 + vat/100))`, valid for `base > 0`, `profit` in `[0, 100)`, and `vat >= 0`. The VAT-inclusive form is authoritative (per the invariant decision). The frontend (`modules/products/lib/pricing.ts:7-12`) and backend `derived_selling_price` (`Backend-administrativo/src/features/medications_agent/src/infrastructure/repositories.rs:114-125`) MUST both implement it; the backend function MUST accept VAT, which it currently omits. An absent `profit` MUST be treated as `0`; a non-finite or `>= 100` profit MUST be rejected, never silently defaulted.

#### Scenario: Frontend/backend parity
- GIVEN the vectors (0.8, 40, 0), (0.8, 40, 16), (10, 30, 16)
- WHEN both implementations derive each vector
- THEN FE and BE return 1.33, 1.55, and 16.57 respectively

#### Scenario: Backend now includes VAT
- GIVEN base_price=0.8, profit=40, vat=16
- WHEN the backend derives the price
- THEN it returns 1.55, not the current VAT-excluded 1.33

#### Scenario: Absent profit defaults to zero
- GIVEN base_price=10 and no profit_percentage
- WHEN the price is derived
- THEN it returns `round2(10 * (1 + vat/100))`

### Requirement: VAT Is Authoritative Per Pharmacy Inventory

The VAT used by the derivation MUST be the per-pharmacy inventory value: stored on the inventory row, editable per pharmacy, transported with the inventory write, and read back by the listing. The listing MUST read the inventory VAT instead of the catalog-only `vat: product.vat` (`Backend-administrativo/src/features/phamacy_action/src/infrastructure/repositories.rs:815`). The effective VAT is the explicit inventory VAT when present; when absent it MUST fall back to the catalog `products.vat`; when neither is numeric it MUST use the documented default `0`. An explicit `0` is a value and MUST NOT trigger the fallback.

#### Scenario: Edit VAT on one pharmacy
- GIVEN pharmacies A and B share a product with vat=0
- WHEN VAT is edited to 16 on pharmacy A and saved
- THEN A's persisted price changes to the VAT-16 derivation and B's price is unchanged

#### Scenario: Explicit zero stays zero
- GIVEN inventory VAT is set to 0
- WHEN the price is derived
- THEN VAT is 0 and no fallback to the catalog or the default occurs

#### Scenario: Absent inventory VAT falls back
- GIVEN an inventory row has no VAT and the catalog product has vat=16
- WHEN the price is derived
- THEN the effective VAT is 16

#### Scenario: No VAT source
- GIVEN neither inventory nor catalog carries a VAT value
- WHEN the price is derived
- THEN the effective VAT is the documented default 0

### Requirement: Explicit Zero VAT Is Preserved End-To-End

An explicit `0` VAT MUST survive from form input to persistence and derivation. `TabCreateProduct.tsx:275,288` `parseInt(vat) || 0` MUST be replaced so `"0"` yields `0`, distinguishable from absent. `bulkSellingPrice` (`modules/products/lib/pricing.ts:40-47`) `vatPct ?? 0` MUST apply only to absent/undefined VAT, never to `0`. The `bulkSellingPrice` test pin at `test/pricing.test.mjs:44` is a deliberate, visible contract change.

#### Scenario: Create with 0% VAT
- GIVEN the create form VAT field contains `0`
- WHEN the product is created
- THEN `vat = 0` is persisted and the price is derived with 0

#### Scenario: Bulk import with 0% VAT
- GIVEN a bulk row has VAT `0` and a base price
- WHEN the row is imported
- THEN the derived price uses the explicit VAT 0 (treated as a value, not as absent)

#### Scenario: Absent VAT still defaults
- GIVEN the VAT field is empty/absent (not `0`)
- WHEN a bulk price is derived
- THEN the documented default 0 applies

### Requirement: Panel Display Equals Charged Register Price

The product panel MUST display exactly the persisted `pharmacy_inventory.price` (USD and Bs at the current rate) as the price that will be charged, and the register MUST charge `fiscalLineTotalBs(persistedPrice, quantity, rate)` (`modules/cash-register/lib/fiscal-totals.ts:42`). The panel currently renders only a derived preview and never `currentMedicine.price` (`modules/products/components/StockFeaturesForm.tsx:97`); after this change the displayed charged price and the register's unit price MUST be the same persisted value.

#### Scenario: Panel equals register after edit
- GIVEN the operator edits cost/profit/VAT and saves
- WHEN the panel renders and the product is added to the register
- THEN panel USD/Bs, register unit price, and stored `price` are equal

#### Scenario: Mismatch is impossible by construction
- GIVEN the invariant holds and the operator reopens the product
- WHEN the panel loads
- THEN the displayed charged price equals the listed stored `price` without a separate preview

### Requirement: Every Price Writer Is Covered By The Invariant

The invariant MUST hold across every writer of `pharmacy_inventory.price` except delivery notes (excluded below): the increase set-clauses (`Backend-administrativo/src/features/medications_agent/src/infrastructure/repositories.rs:295-315,:320-334,:336-371`), Excel import-stock insert/update (`:1274-1291,:1318-1338`), `batch_add_medications` (`.../phamacy_action/.../repositories.rs:735-744`), purchase-invoice existing/new lot rows (`.../purchase_invoices/.../purchase_invoices_impl.rs:125-134,:156-165`), and the catalog create path that currently discards `price`/`basePrice`/`profitPercentage` (`.../medications/.../repositories_products.rs:264-381`; FE sends them at `modules/products/api/products.service.ts:106-133`). The catalog create path MUST route pricing to the per-pharmacy inventory write, or explicitly reject it, and MUST NOT silently discard it.

Delivery-note update/create (`.../delivery_note/src/infrastructure/repositories.rs:518-529`) MUST NOT derive the inventory price: its line `precio_unitario` defaults to the current inventory sale price, so deriving from it would double-count/inflate it. Delivery notes are an explicit non-goal of this invariant (design D5).

#### Scenario: Each writer derives
- GIVEN any listed writer receives a changed derivation input
- WHEN it persists the row
- THEN the persisted price equals the derived value

#### Scenario: Catalog create no silent discard
- GIVEN the FE create payload carries price/basePrice/profitPercentage
- WHEN `POST /Medications/Create` runs
- THEN pricing reaches the inventory write (or is rejected loudly), not dropped

### Requirement: Backfill Reconciles Existing Divergent Rows

A backfill MUST recompute `price` for every `pharmacy_inventory` row whose persisted price differs from its derived value. It MUST be idempotent, MUST be reversible (persist prior values for rollback), and MUST support a dry-run mode that reports pre/post divergent counts and a before/after diff without writing. Rows with NULL derivation inputs MUST be left unchanged and reported, not guessed. It MUST be rehearsed on a snapshot before touching production. Acceptance evidence: divergent count before, reconciled count after, zero unexplained rows, and rollback restoring exact prior values.

#### Scenario: Dry run
- GIVEN divergent rows exist
- WHEN the backfill runs in dry-run mode
- THEN no row is written and pre/post counts plus the diff are reported

#### Scenario: Apply reconciles
- GIVEN the dry run is accepted
- WHEN the backfill applies
- THEN every divergent row with usable inputs has `price = derived(...)`

#### Scenario: Rollback
- GIVEN the backfill was applied
- WHEN rollback runs from stored prior values
- THEN every row regains its exact pre-backfill price

#### Scenario: NULL inputs skipped
- GIVEN a divergent row has NULL base_price/profit
- WHEN the backfill runs
- THEN the row is unchanged and listed in the report

### Requirement: Tri-State Pricing Inputs Preserved Under The Invariant

`base_price`, `profit_percentage`, `discount`, and the new `vat` MUST keep absent/null/explicit-value semantics (see `openspec/specs/inventory-pricing-fields/spec.md`): absent leaves the stored value unchanged, explicit null clears it, a value sets it. An explicit `0` MUST remain distinguishable from absent for every field, especially `vat`.

#### Scenario: Value vs clear vs absent
- GIVEN a row with base_price, profit, discount, and vat all present
- WHEN a write sets one value, clears another, and omits a third
- THEN the set field updates, the cleared field becomes NULL, and the omitted field is untouched

#### Scenario: Zero is a value
- GIVEN any of the four fields is explicitly `0`
- WHEN it is written
- THEN it is stored as `0`, not treated as absent or defaulted
