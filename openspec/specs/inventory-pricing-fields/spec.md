# Inventory Pricing Fields Specification

## Purpose
Persists nullable `basePrice`/`profitPercentage`/`vat` (`base_price`/`profit_percentage`/`vat`) on per-pharmacy inventory across all insertion points in `ERP_medizin_web` (frontend) and `Backend-administrativo` (Rust/SurrealDB), threaded end-to-end. These fields are the derivation inputs consumed by `inventory-price-derivation`.

## Requirements

### Requirement: Inventory Model Persists Nullable Pricing Fields
The system MUST store `base_price` (`Option<f64>`), `profit_percentage` (`Option<f64>`), and `vat` (`Option<f64>`) on `ModelInventory` and `ModelMedicationsaux` in SurrealDB; `ModelMedications` catalog MUST NOT gain `base_price`/`profit_percentage`, and its existing `vat` column stays as-is.

#### Scenario: New inventory row with all values
- GIVEN a per-pharmacy inventory insert provides base_price=10.0, profit_percentage=0.2, vat=0
- WHEN the row is persisted
- THEN the stored record contains base_price=10.0, profit_percentage=0.2, and vat=0

#### Scenario: Missing values store NULL
- GIVEN an insert omits all three fields
- WHEN the row is persisted
- THEN base_price, profit_percentage, and vat are stored as NULL and the row is valid

### Requirement: Create-Medication DTO Carries Pricing Fields
The system MUST accept `base_price`/`profit_percentage` on the `Vec<ModelMedicationsaux>` payload of `POST /admin/Medications/Create`.

#### Scenario: Catalog create with pricing
- GIVEN a ModelMedicationsaux payload includes base_price and profit_percentage
- WHEN POST /Medications/Create is received
- THEN the DTO deserializes both fields without error

#### Scenario: Absent fields default null
- GIVEN the payload omits both fields
- WHEN POST /Medications/Create is received
- THEN deserialization succeeds with both fields None

### Requirement: Increase-Inventory DTO Carries Pricing Fields
The system MUST accept `base_price`/`profit_percentage`/`vat` on `IncreaseInventoryRequest` and each `IncreaseMedicationItem` for `POST /admin/MedicationsAgent/increase`, and the real-time `increase_inventory` writer MUST persist all three into the `ModelInventory` record (CREATE or conditional UPDATE).

#### Scenario: Increase with VAT
- GIVEN an IncreaseMedicationItem carries base_price, profit_percentage, and vat
- WHEN the increase request is processed
- THEN all three map onto the resulting record and the writer persists them

#### Scenario: Explicit zero VAT
- GIVEN an IncreaseMedicationItem carries vat=0
- WHEN the increase request is processed
- THEN vat is stored as 0, not dropped or defaulted

#### Scenario: Increase without pricing
- GIVEN an IncreaseMedicationItem omits the fields
- WHEN the increase request is processed
- THEN they are None and mapping does not fail

### Requirement: MedicationProto Carries Pricing Fields
The system MUST define `optional double base_price`, `optional double profit_percentage`, and `optional double vat` on `MedicationProto` (proto3), preserving wire compatibility with existing consumers.

#### Scenario: Proto with values
- GIVEN a MedicationProto is built with base_price, profit_percentage, and vat set
- WHEN it is serialized
- THEN all three optional doubles are encoded as present fields

#### Scenario: Proto without values
- GIVEN a MedicationProto leaves the fields unset
- WHEN it is serialized
- THEN it omits them and existing consumers still decode it

### Requirement: Excel Import Threads Pricing Fields
The system MUST thread base_price/profit_percentage through `ApplyPharmacyMedicationStockUseCase` for `import-stock`/`import-prices`, setting NULL when the columns are absent.

#### Scenario: Excel columns present
- GIVEN an uploaded Excel row has base_price and profit_percentage columns
- WHEN ApplyPharmacyMedicationStockUseCase runs
- THEN the inventory record receives both values

#### Scenario: Excel columns absent
- GIVEN an uploaded Excel row lacks both columns
- WHEN ApplyPharmacyMedicationStockUseCase runs
- THEN the inventory record stores NULL for both without error

### Requirement: Frontend Inventory Types Carry Optional Pricing Fields
The system MUST define optional `basePrice?: number`, `profitPercentage?: number`, and `vat?: number` on `Medication`, `BulkProductRow`, the `increaseInventory` payload, and the `createProduct` payload.

#### Scenario: Type carries values
- GIVEN a Medication sets basePrice=10, profitPercentage=0.2, vat=0
- WHEN it is passed to createProduct/increaseInventory
- THEN the fields serialize into the outbound payload

#### Scenario: Type without values
- GIVEN a Medication omits the fields
- WHEN it is passed to createProduct/increaseInventory
- THEN the payload omits them without a type error

### Requirement: TabCreateProduct Exposes Pricing Inputs
The system MUST render inputs (base price, profit %, VAT) in `TabCreateProduct` that submit `basePrice`/`profitPercentage`/`vat` via createMedication. When the submitted payload carries price/minimum/discount/base_price/profit_percentage/vat, the system MUST link the pharmacy inventory through `increaseInventory` even when initial stock is 0 (`modules/products/hook/useCreateProduct.ts:92`). An explicit VAT of `0` MUST be submitted as `0` (fixing `TabCreateProduct.tsx:275,288` `parseInt(vat) || 0`).

#### Scenario: User enters values including zero VAT
- GIVEN the create form renders base price, profit % and VAT inputs and the user enters VAT 0 with other values
- WHEN the user submits
- THEN createMedication receives vat=0 alongside basePrice/profitPercentage

#### Scenario: Price-only create with zero stock
- GIVEN the `barCode` already exists in the pharmacy and the user supplies a price with stock 0
- WHEN the create succeeds
- THEN `increaseInventory` runs with that price, vat carried, and a 0 stock delta

#### Scenario: User leaves blank
- GIVEN the inputs are empty
- WHEN the user submits
- THEN basePrice/profitPercentage/vat are submitted as null/undefined and the request succeeds

### Requirement: StockFeaturesForm Exposes Pricing Inputs
The system MUST render two inputs in `StockFeaturesForm` distinct from the computed "Precio Base (sin IVA)" display, submitting basePrice/profitPercentage via saveMedicine. When any of price, minimum, discount, base_price, or profit_percentage changed for an EXISTING product, the system MUST run the price-carrying `increaseInventory` write even when the stock delta is 0; the stock field MUST remain an additive delta and MUST NOT gate the write (`modules/products/store/products.store.ts:329`).

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

### Requirement: BulkImportDialog Call Site Stays Compiling
The system MUST keep `BulkImportDialog` compiling by passing null/default for basePrice/profitPercentage (future Excel columns).

#### Scenario: Current build
- GIVEN BulkImportDialog builds a BulkProductRow
- WHEN it passes products to createProduct/increaseInventory
- THEN it passes basePrice/profitPercentage as null/default and type-checks

#### Scenario: Future columns
- GIVEN future Excel columns supply the values
- WHEN the import maps them
- THEN the call site forwards the parsed values without structural change

### Requirement: Null Handling Is Safe Everywhere
The system MUST store NULL (not zero, not error) for any insertion point lacking the value, and pricing logic MUST treat NULL as "unknown". NULL MUST stay distinct from an explicit `0`: a NULL VAT is unknown (eligible for fallback), a `0` VAT is a deliberate value.

#### Scenario: Insert without value
- GIVEN any insertion point (UI, HTTP, Excel, MQTT) omits a pricing field
- WHEN persistence runs
- THEN NULL is stored and no exception is raised

#### Scenario: Read null
- GIVEN a stored record has NULL base_price/profit_percentage/vat
- WHEN it is read back
- THEN consumers receive null and must not assume a numeric default

#### Scenario: NULL differs from zero
- GIVEN two rows, one with vat NULL and one with vat 0
- WHEN each is read for derivation
- THEN the NULL row is eligible for fallback and the `0` row derives with VAT 0

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

## Archive Note — R3 Persisted Through Real-Time Writer (Resolved Post-Verify)

Verification reported a single WARNING against R3: the real-time `increase_inventory` writer that persists inventory via MQTT (`CREATE` + conditional `UPDATE`) was dropping `base_price`/`profit_percentage`. This was resolved in a backend follow-up commit (`70cafaa7`, pushed to `feat/product-base-price-profit-fields`) which threads both fields through the writer's `CREATE` and conditional `UPDATE` paths. After this fix, R3 verifies as PASSING. No requirement changed semantically; the R3 "Increase with pricing" scenario above now also asserts persistence into `ModelInventory`.
