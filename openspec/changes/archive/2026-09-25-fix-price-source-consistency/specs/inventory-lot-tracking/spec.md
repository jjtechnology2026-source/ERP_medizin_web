# Delta for Inventory Lot Tracking

## ADDED Requirements

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

## Resolved Decision (Design D5)

- **Per-lot price intent.** Purchase invoices use *per-lot acquisition cost*: the invoice `precio_unitario` becomes the lot's `base_price` and `price` is derived from it. Delivery notes are EXCLUDED from the invariant — their line `precio_unitario` defaults to the current inventory sale price, so deriving from it would inflate the inventory price. This resolves the previously open decision; delivery notes are a documented non-goal.
