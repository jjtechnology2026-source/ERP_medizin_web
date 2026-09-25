# Inventory Lot Tracking Specification

## Purpose

Optional text-only lot label (`lote`) captured on frontend stock-intake flows — manual add-stock (`StockFeaturesForm`), product creation with initial stock (`TabCreateProduct` via `useCreateProduct`), and bulk Excel import (`BulkImportDialog`) — and forwarded on each item of the `increaseInventory` payload (`POST /admin/MedicationsAgent/increase`). Blank or absent values degrade to the backend "SIN LOTE" bucket. No sale-side, read-model, or proto behavior changes.

## Requirements

### Requirement: Increase-Inventory Payload Carries Optional Lot
The system MUST accept an optional `lote?: string | null` on each `increaseInventory` item sent to `POST /admin/MedicationsAgent/increase`, using the single-word key `lote` (identical under camel and snake conventions).

#### Scenario: Increase with lot
- GIVEN a stock-intake flow provides `lote: "L-2026-01"`
- WHEN the increase request is sent
- THEN the item carries `lote: "L-2026-01"` and the request succeeds

#### Scenario: Increase without lot
- GIVEN a stock-intake flow leaves the lot blank or omits it
- WHEN the increase request is sent
- THEN the item omits `lote` (encoded null) and the request succeeds, routing to the backend "SIN LOTE" bucket

### Requirement: Frontend Stock Types Carry Optional Lot
The system MUST define `lote?: string` on `Medication`, `BulkProductRow` (in `modules/products/types/products.types.ts`) and `MedicationData` (`modules/products/hook/useCreateProduct.ts`).

#### Scenario: Type with lot
- GIVEN an object sets `lote: "L-2026-01"`
- WHEN it is passed to a stock-intake call site
- THEN the field type-checks and serializes into the outbound payload

#### Scenario: Type without lot
- GIVEN an object omits `lote`
- WHEN it is passed to a stock-intake call site
- THEN the code type-checks and the payload omits the field

### Requirement: StockFeaturesForm Captures Lot on Add-Stock
The system MUST render an optional lot input in `StockFeaturesForm` and MUST forward a trimmed `lote` only when the stock delta is greater than zero. When a save fires the increase with a zero stock delta to persist price fields, the item MUST omit `lote`, so a price edit writes only the no-lot scope and never attaches a lot to a non-stock write (`modules/products/store/products.store.ts:337`).

#### Scenario: User adds stock with lot
- GIVEN the form shows the Lote input and the user enters a lot plus a positive quantity
- WHEN the user saves
- THEN `saveMedicine`'s increase item includes the trimmed lot alongside the delta

#### Scenario: User adds stock leaving lot blank
- GIVEN the Lote input is empty
- WHEN the user saves a positive quantity
- THEN the increase item omits the lot (SIN LOTE) and the save succeeds

#### Scenario: Price-only edit carrying a lot value
- GIVEN the user changes a price field with a zero stock delta and the Lote input has a value
- WHEN the user saves
- THEN the increase fires for the price but the item omits `lote`

#### Scenario: Lot-only edit (zero quantity)
- GIVEN the user changes the lot but leaves quantity at zero and no price/minimum/discount changed
- WHEN the user saves
- THEN no increase fires and no lot is sent (lot belongs to the stock delta, not an idempotent attribute)

### Requirement: TabCreateProduct Captures Lot on Initial Stock
The system MUST render an optional lot input beside "Stock inicial" in `TabCreateProduct` and MUST forward it on the initial-stock `increaseInventory` call when initial stock is greater than zero.

#### Scenario: Create with initial stock and lot
- GIVEN the user sets stock > 0 and a lot
- WHEN the product is created
- THEN the initial-stock increase item includes the lot

#### Scenario: Create with initial stock, blank lot
- GIVEN the user sets stock > 0 but leaves the lot empty
- WHEN the product is created
- THEN the increase item omits the lot and the create succeeds

### Requirement: Bulk Excel Import Supports Optional Lote Column
The system MUST include an optional "Lote" column in the downloadable Excel template, MUST map a non-empty cell to `BulkProductRow.lote`, and MUST keep files without the column importing unchanged (degrading to SIN LOTE).

#### Scenario: Excel row with lot
- GIVEN an uploaded row has a non-empty Lote cell
- WHEN the file is parsed and saved
- THEN the parsed row carries the trimmed lot and the post-link increase forwards it

#### Scenario: Excel without Lote column
- GIVEN an uploaded file lacks the Lote column (legacy template)
- WHEN the file is parsed and saved
- THEN parsing succeeds, `lote` stays undefined, and the post-link increase omits it without error

### Requirement: Catalog Create Payload Stays Unchanged
The system MUST NOT add `lote` to the `createProduct`/`POST /Medications/Create` catalog payload; the lot belongs to the per-pharmacy inventory increase, not to the national catalog record.

#### Scenario: Catalog create unaffected
- GIVEN a product is created from any flow with or without a lot
- WHEN `createProduct` builds the catalog payload
- THEN the payload contains exactly today's fields (no `lote`)

### Requirement: Sale Flow Stays Unchanged
The system MUST NOT add `lote` to the order payload, the `buildModelOrder` medication map (`current-order.store.ts:384-403`), or the `orders/types/orders.ts` `Medication` type. Lot stamping on persisted order lines is backend-owned.

#### Scenario: Checkout payload identical
- GIVEN a sale is completed after lots exist on stock intakes
- WHEN the order is submitted
- THEN the order payload is identical to today's payload and the backend stamps lots on the persisted lines

### Requirement: Lot Is Plain Trimmed Text With No Expiry Semantics
The system MUST treat `lote` as free text: trim surrounding whitespace before sending, and MUST NOT parse dates, expiry, or any structured format.

#### Scenario: Whitespace-only lot
- GIVEN a user or Excel cell contains only spaces
- WHEN the intake is processed
- THEN the lot is treated as absent (SIN LOTE)

#### Scenario: Text with surrounding spaces
- GIVEN a user enters " L-2026-01 "
- WHEN the intake is processed
- THEN the forwarded lot is "L-2026-01" (trimmed)

### Requirement: No-Lote Writes Do Not Fabricate Lot Labels
The system MUST NOT create a new lot-labeled inventory row, nor assign a lot label, as a side effect of a no-lote price save. Any price change a no-lote save makes to existing rows MUST NOT create, rename, or re-label lot rows.

#### Scenario: No new lot row
- GIVEN a product has one or more existing lot rows
- WHEN a no-lote price is saved
- THEN no new lot-labeled row is created

#### Scenario: Existing lots keep their labels
- GIVEN a product has lot rows "L-2026-01" and "L-2026-02"
- WHEN a no-lote price is saved
- THEN both labels remain unchanged and no lot label is reassigned

### Requirement: Per-Lot Acquisition Price Derives Under The Invariant

When a purchase-invoice write persists a per-lot price (`Backend-administrativo/src/features/purchase_invoices/.../purchase_invoices_impl.rs:125-134,:156-165`), the system MUST treat that per-lot price as the lot's acquisition cost (`base_price`) and MUST persist the row's `price` as the derivation of that cost with the product's effective `profit_percentage` and the pharmacy's effective `vat` (per `inventory-price-derivation`), not as the raw entered price. Per-lot rows MUST NOT be left with `base_price`/`profit_percentage` NULL when a derivation is required.

Delivery notes are EXCLUDED from this invariant (design D5): a delivery-note lot write (`.../delivery_note/src/infrastructure/repositories.rs:518-529`) MUST NOT derive the inventory price from its line `precio_unitario`, which defaults to the current inventory sale price and would double-count/inflate it. A lot row created or updated by a delivery note MUST keep the inventory price unchanged by the derivation; the delivery note remains a document-only price.

#### Scenario: Invoice lot row derives
- GIVEN a purchase invoice writes a lot row with unit cost 0.8 and the product profit is 40 and pharmacy VAT is 0
- WHEN the row is persisted
- THEN its base_price is 0.8, its profit_percentage is 40, and its price is 1.33

#### Scenario: Delivery note lot write is excluded
- GIVEN a delivery note writes a lot row with a per-lot price and the invariant inputs are known
- WHEN the row is persisted
- THEN the inventory price is unchanged by the derivation and no `price` or pricing input is derived from the delivery-note line

#### Scenario: Aggregate inputs stay coherent
- GIVEN multiple lot rows for a product
- WHEN any lot row is written
- THEN `math::max(base_price)` and `math::max(price)` are derived from coherent inputs, not mixed NULL/values


### Requirement: Lot-Carrying Pricing Writes Keep The Aggregated Price Consistent

The system MUST ensure the cursor listing (`math::max(price)`) reflects the derived price after any write that changes pricing inputs, including when the write carries a lot label and when the derived price is LOWER than the previous maximum. The current propagation gate (`Backend-administrativo/src/features/medications_agent/src/infrastructure/repositories.rs:266-273`, applied at `:618-628`) only fans out for a no-lote, positive-price write and MUST NOT leave a stale higher lot price. Read semantics (LOT-REQ-006) MUST NOT change.

#### Scenario: Lot write decreases the aggregated price
- GIVEN lot rows whose maximum price is 1500
- WHEN a write carrying a lot changes the derived price to 1100
- THEN the aggregated listing returns 1100, not the stale 1500

#### Scenario: No-lote write still propagates
- GIVEN a product with lot rows
- WHEN a no-lote pricing write is processed
- THEN every row's price is updated to the derived value

#### Scenario: Read semantics unchanged
- GIVEN a product with multiple lot rows
- WHEN the listing is read
- THEN its price is still `math::max(price)` across rows


### Requirement: Lot Scope Is Unchanged By The Invariant

The invariant MUST NOT alter lot ownership: `stock`, `minimum`, `lote`, and expiry remain row-scoped; a pricing write MUST NOT create, rename, re-label, or merge lot rows, and `lote` MUST remain plain trimmed text with no expiry semantics (see the existing requirements above).

#### Scenario: Pricing write adds no lot row
- GIVEN a product has existing lot rows
- WHEN a pricing write fires
- THEN no new lot-labeled row is created and existing labels are unchanged

#### Scenario: Row-scoped stock preserved
- GIVEN a lot row with stock
- WHEN another row's price is derived
- THEN no stock is moved between rows
