# Inventory Pricing Fields Specification

## Purpose
Persists nullable `basePrice`/`profitPercentage` (`base_price`/`profit_percentage`) on per-pharmacy inventory across all insertion points in `ERP_medizin_web` (frontend) and `Backend-administrativo` (Rust/SurrealDB), threaded end-to-end. No price-derivation logic is added.

## Requirements

### Requirement: Inventory Model Persists Nullable Pricing Fields
The system MUST store `base_price` (`Option<f64>`) and `profit_percentage` (`Option<f64>`) on `ModelInventory` and `ModelMedicationsaux` in SurrealDB; `ModelMedications` catalog MUST NOT gain these fields.

#### Scenario: New inventory row with both values
- GIVEN a per-pharmacy inventory insert provides base_price=10.0 and profit_percentage=0.2
- WHEN the row is persisted
- THEN the stored record contains base_price=10.0 and profit_percentage=0.2

#### Scenario: Missing values store NULL
- GIVEN an insert omits both fields
- WHEN the row is persisted
- THEN base_price and profit_percentage are stored as NULL and the row is valid

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
The system MUST accept `base_price`/`profit_percentage` on `IncreaseInventoryRequest` and each `IncreaseMedicationItem` for `POST /admin/MedicationsAgent/increase`.

#### Scenario: Increase with pricing
- GIVEN an IncreaseMedicationItem carries base_price and profit_percentage
- WHEN the increase request is processed
- THEN both values map onto the resulting MedicationProto AND the real-time `increase_inventory` writer persists them into the `ModelInventory` record (CREATE or conditional UPDATE) rather than dropping them

#### Scenario: Increase without pricing
- GIVEN an IncreaseMedicationItem omits both fields
- WHEN the increase request is processed
- THEN both values are None and mapping does not fail

### Requirement: MedicationProto Carries Pricing Fields
The system MUST define `optional double base_price` and `optional double profit_percentage` on `MedicationProto` (proto3), preserving wire compatibility with existing consumers.

#### Scenario: Proto with values
- GIVEN a MedicationProto is built with base_price and profit_percentage set
- WHEN it is serialized
- THEN both optional doubles are encoded as present fields

#### Scenario: Proto without values
- GIVEN a MedicationProto leaves both fields unset
- WHEN it is serialized
- THEN it omits the fields and existing consumers still decode it

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
The system MUST define optional `basePrice?: number` and `profitPercentage?: number` on `Medication`, `BulkProductRow`, the `increaseInventory` payload, and the `createProduct` payload.

#### Scenario: Type carries values
- GIVEN a Medication object sets basePrice=10 and profitPercentage=0.2
- WHEN it is passed to createProduct/increaseInventory
- THEN the fields serialize into the outbound payload

#### Scenario: Type without values
- GIVEN a Medication object omits both fields
- WHEN it is passed to createProduct/increaseInventory
- THEN the payload omits them (undefined→null on encode) without type error

### Requirement: TabCreateProduct Exposes Pricing Inputs
The system MUST render two inputs (base price, profit %) in `TabCreateProduct` that submit `basePrice`/`profitPercentage` via createMedication.

#### Scenario: User enters values
- GIVEN the create form renders base price and profit % inputs
- WHEN the user fills both and submits
- THEN createMedication receives basePrice and profitPercentage

#### Scenario: User leaves blank
- GIVEN the inputs are empty
- WHEN the user submits
- THEN basePrice/profitPercentage are submitted as null/undefined and the request succeeds

### Requirement: StockFeaturesForm Exposes Pricing Inputs
The system MUST render two inputs in `StockFeaturesForm` distinct from the computed "Precio Base (sin IVA)" display, submitting basePrice/profitPercentage via saveMedicine.

#### Scenario: User enters values
- GIVEN StockFeaturesForm shows base price and profit % inputs separate from the ex-VAT display
- WHEN the user fills both and saves
- THEN saveMedicine passes basePrice and profitPercentage to createProduct+increaseInventory

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
The system MUST store NULL (not zero, not error) for any insertion point lacking the value, and future pricing logic MUST treat NULL as "unknown".

#### Scenario: Insert without value
- GIVEN any insertion point (UI, HTTP, Excel, MQTT) omits the fields
- WHEN persistence runs
- THEN NULL is stored and no exception is raised

#### Scenario: Read null
- GIVEN a stored record has NULL base_price/profit_percentage
- WHEN it is read back
- THEN consumers receive null and must not assume a numeric default

## Archive Note — R3 Persisted Through Real-Time Writer (Resolved Post-Verify)

Verification reported a single WARNING against R3: the real-time `increase_inventory` writer that persists inventory via MQTT (`CREATE` + conditional `UPDATE`) was dropping `base_price`/`profit_percentage`. This was resolved in a backend follow-up commit (`70cafaa7`, pushed to `feat/product-base-price-profit-fields`) which threads both fields through the writer's `CREATE` and conditional `UPDATE` paths. After this fix, R3 verifies as PASSING. No requirement changed semantically; the R3 "Increase with pricing" scenario above now also asserts persistence into `ModelInventory`.
