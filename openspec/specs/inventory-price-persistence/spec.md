# Inventory Price Persistence Specification

## Purpose

Existing-product price edits persist from every entry point; the persisted price is observable after reload and inventory write failures are surfaced.

## Requirements

### Requirement: Existing-Product Edits Persist From Every Entry Point
The system MUST resolve product existence against the authoritative server source (`findInventoryItem`, `modules/products/store/products.store.ts:210`), NOT the in-memory current page (`inventory`, size 10 — `products.store.ts:11`), and MUST run the price-carrying `increaseInventory` write (`modules/products/api/products.service.ts:196`) for every existing product.

#### Scenario: Product on the current page
- GIVEN the edited product is on the loaded page
- WHEN the user saves
- THEN `increaseInventory` runs and the price persists

#### Scenario: Product absent from the current page (catalog-sourced)
- GIVEN the `barCode` exists server-side but not on the page (`products.store.ts:279`)
- WHEN the user saves
- THEN existence resolves server-side and the price persists after refresh

#### Scenario: Genuinely new product
- GIVEN the `barCode` does not exist server-side
- WHEN the user saves
- THEN catalog create plus inventory link run without error

### Requirement: Persisted Price Is Observable After Reload
The system MUST make a saved price visible in the inventory listing (`GET /admin/Pharmacy/{id}/medications/cursor`) after reload for single-row AND multi-lot products, including when the new price is LOWER than any stored row price. The persisted price MUST equal the derivation invariant (`inventory-price-derivation`): after any write that changes `base_price`, `profit_percentage`, or `vat`, every affected row's `price` equals `derived(base_price, profit_percentage, vat)`. `low_stock`, `resumen`/`valor_venta`, and PDF inventory reports MUST stay consistent with that price (`Backend-administrativo/src/features/phamacy_action/src/infrastructure/repositories.rs:872,:942,:981,:1077`; `.../inventory_movements/.../repositories.rs:173`).

#### Scenario: Single-row decrease then increase
- GIVEN one row at price 1500
- WHEN the price is lowered to 1100 and saved, then raised to 1300 and saved
- THEN the listing returns 1100 then 1300 after reload

#### Scenario: Multi-lot decrease
- GIVEN lot rows whose maximum price is 1500
- WHEN a pricing write lowers the derived price to 1100
- THEN the listing returns 1100, not the stale 1500

#### Scenario: Derived price after reload
- GIVEN a write changes base_price/profit/vat so derived=1.55
- WHEN the listing is read after reload
- THEN it returns price 1.55 and the panel shows the same stored value

#### Scenario: Lot-carrying decrease is visible
- GIVEN a product with lot rows and the derived price decreases
- WHEN a pricing write carries a lot label
- THEN the affected rows persist the derived price and the aggregated listing reflects the decrease

#### Scenario: Reporting consumers
- GIVEN a lowered price
- WHEN `low_stock`, `resumen`/`valor_venta`, and the PDF report are read
- THEN they reflect the same price without error

### Requirement: Inventory Write Failures Are Surfaced
The system MUST NOT swallow an `increaseInventory` failure while reporting success; on failure the caller MUST receive a failure result, the user MUST be told, and the save MUST NOT claim the price persisted (`products.store.ts:342-344`).

#### Scenario: Write fails
- GIVEN the backend returns an error
- WHEN the user saves
- THEN the UI reports failure, not success

### Requirement: Realtime Echo Does Not Double-Count a Local Delta
The system MUST keep inventory stock after a save plus its echo equal to the authoritative value: the MQTT insert/update handler MUST NOT re-add a delta already applied optimistically (`products.store.ts:307` vs `modules/products/providers/MqttInventoryProvider.tsx:126`).

#### Scenario: Save then echo
- GIVEN stock 10 and a saved +5 delta (optimistic 15)
- WHEN the matching echo arrives
- THEN stock stays 15, not 20

### Requirement: Existing Stock-Add and Bulk-Import Paths Are Unregressed
The system MUST keep all three `increaseInventory` call sites correct (`modules/products/hook/useCreateProduct.ts:93`, `products.store.ts:329`, `modules/products/components/BulkImportDialog.tsx:234`): a positive stock delta MUST stay ADDITIVE, minimum/discount edits MUST persist, and bulk import MUST keep linking positive-stock rows.

#### Scenario: Positive stock add
- GIVEN stock 10 and an added 5
- WHEN saved
- THEN stock becomes 15

#### Scenario: Bulk import with stock
- GIVEN imported rows have stock > 0
- WHEN imported
- THEN inventory is linked as today

#### Scenario: Minimum/discount edit
- GIVEN minimum or discount changed with zero stock delta
- WHEN saved
- THEN the new value persists

### Requirement: Price Floor and Pricing Semantics Are Unchanged
The system MUST NOT make `price = 0` settable as a stored price: an explicit 0 or absent price MUST preserve the stored price (`Backend-administrativo/src/features/medications_agent/src/infrastructure/repositories.rs:527`), and this preserve rule MUST coexist with the invariant (a preserved price is not re-derived unless a derivation input changed). Currency handling MUST stay unchanged and no new pricing endpoint is introduced. The cost→price derivation definition does change deliberately: it is now the single VAT-inclusive formula in `inventory-price-derivation` (previously `lib/pricing.ts:29-38` and the backend disagreed on VAT).

#### Scenario: Zero or absent price
- GIVEN stored price 1500 and an increase sends 0 or omits price
- WHEN processed and no derivation input changed
- THEN the stored price remains 1500

#### Scenario: Derivation now includes VAT
- GIVEN the user edits cost, profit, or per-pharmacy VAT
- WHEN the price is derived anywhere in the system
- THEN it uses the single VAT-inclusive formula from `inventory-price-derivation`


### Requirement: Read-Only Price Consumers Stay Consistent Under The Invariant
The system MUST NOT change read-path semantics while enforcing the invariant. The listing aggregation MUST keep `math::max(price)` for a product's price (LOT-REQ-006). `resumen.valor_venta` (`Backend-administrativo/src/features/phamacy_action/src/infrastructure/repositories.rs:981`), inventory-movement price snapshots (`.../inventory_movements/src/infrastructure/repositories.rs:173`), `pharmacy_search` (`.../pharmacy_search/src/infrastructure/repositories.rs:276`), and PDF inventory reports MUST keep returning consistent values from the invariant-satisfying rows.

#### Scenario: valor_venta regression check
- GIVEN stored rows all satisfy the invariant
- WHEN `resumen`/`valor_venta` is computed
- THEN it equals `math::sum(stock * price)` over those rows without error

#### Scenario: Movement snapshot
- GIVEN a pricing write
- WHEN an inventory movement is recorded
- THEN its before/after price values are the stored (derived) prices

#### Scenario: Listing aggregation unchanged
- GIVEN a multi-lot product
- WHEN the cursor listing is read
- THEN `price` is still `math::max(price)` across its rows
