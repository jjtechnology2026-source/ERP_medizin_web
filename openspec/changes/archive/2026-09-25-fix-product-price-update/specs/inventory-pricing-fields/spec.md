# Delta for Inventory Pricing Fields

## MODIFIED Requirements

### Requirement: StockFeaturesForm Exposes Pricing Inputs
The system MUST render two inputs in `StockFeaturesForm` distinct from the computed "Precio Base (sin IVA)" display, submitting basePrice/profitPercentage via saveMedicine. When any of price, minimum, discount, base_price, or profit_percentage changed for an EXISTING product, the system MUST run the price-carrying `increaseInventory` write even when the stock delta is 0; the stock field MUST remain an additive delta and MUST NOT gate the write (`modules/products/store/products.store.ts:329`).
(Previously: pricing fields reached `increaseInventory` only alongside a positive stock delta.)

#### Scenario: User enters values
- GIVEN StockFeaturesForm shows base price and profit % inputs separate from the ex-VAT display
- WHEN the user fills both and saves
- THEN saveMedicine passes basePrice and profitPercentage to createProduct+increaseInventory

#### Scenario: Price-only edit with zero stock delta
- GIVEN an existing product and the user changes price/minimum/discount/base price/profit % and leaves the stock delta at 0
- WHEN the user saves
- THEN `increaseInventory` runs carrying those values, price/minimum/discount/base_price/profit_percentage persist, and stock is unchanged

#### Scenario: User leaves blank
- GIVEN the new inputs are empty
- WHEN the user saves
- THEN both fields are null and the existing computed display is unchanged

### Requirement: TabCreateProduct Exposes Pricing Inputs
The system MUST render two inputs (base price, profit %) in `TabCreateProduct` that submit `basePrice`/`profitPercentage` via createMedication. When the submitted payload carries price/minimum/discount/base_price/profit_percentage, the system MUST link the pharmacy inventory through `increaseInventory` even when initial stock is 0 (`modules/products/hook/useCreateProduct.ts:92`).
(Previously: the inventory link was gated on `quantityVal > 0`, so a price-only create never reached the inventory write.)

#### Scenario: User enters values
- GIVEN the create form renders base price and profit % inputs
- WHEN the user fills both and submits
- THEN createMedication receives basePrice and profitPercentage

#### Scenario: Price-only create with zero stock
- GIVEN the submitted `barCode` already exists in the pharmacy and the user supplies a price with stock 0
- WHEN the create succeeds
- THEN `increaseInventory` runs with that price and a 0 stock delta, and the price persists

#### Scenario: User leaves blank
- GIVEN the inputs are empty
- WHEN the user submits
- THEN basePrice/profitPercentage are submitted as null/undefined and the request succeeds

## ADDED Requirements

### Requirement: Bulk Import Persists Pricing Without Positive Stock
The system MUST link inventory for a bulk-imported row that carries price/pricing fields even when its stock is 0, and MUST NOT let the current "no stock > 0" guard suppress such rows (`modules/products/components/BulkImportDialog.tsx:224-229`). Rows with no pricing fields and stock 0 MAY remain unlinked, and the import MUST still succeed.

#### Scenario: Price-only imported row
- GIVEN an imported row has a price and stock 0
- WHEN the import saves
- THEN the post-link `increaseInventory` includes that row and the price persists

#### Scenario: Row with positive stock
- GIVEN an imported row has stock > 0
- WHEN the import saves
- THEN the row is linked as today

#### Scenario: Row with neither stock nor pricing
- GIVEN an imported row has stock 0 and no pricing fields
- WHEN the import saves
- THEN it may be skipped for the inventory link and the import still reports success
