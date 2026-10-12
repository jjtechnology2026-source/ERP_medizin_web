# Delta for Inventory Pricing Fields

## MODIFIED Requirements

### Requirement: Inventory Model Persists Nullable Pricing Fields
The system MUST store `base_price` (`Option<f64>`), `profit_percentage` (`Option<f64>`), and `vat` (`Option<f64>`) on `ModelInventory` and `ModelMedicationsaux` in SurrealDB; `ModelMedications` catalog MUST NOT gain `base_price`/`profit_percentage`, and its existing `vat` column stays as-is.
(Previously: only `base_price` and `profit_percentage` were nullable inventory fields; `vat` existed only on the catalog.)

#### Scenario: New inventory row with all values
- GIVEN a per-pharmacy inventory insert provides base_price=10.0, profit_percentage=0.2, vat=0
- WHEN the row is persisted
- THEN the stored record contains base_price=10.0, profit_percentage=0.2, and vat=0

#### Scenario: Missing values store NULL
- GIVEN an insert omits all three fields
- WHEN the row is persisted
- THEN base_price, profit_percentage, and vat are stored as NULL and the row is valid

### Requirement: Increase-Inventory DTO Carries Pricing Fields
The system MUST accept `base_price`/`profit_percentage`/`vat` on `IncreaseInventoryRequest` and each `IncreaseMedicationItem` for `POST /admin/MedicationsAgent/increase`, and the real-time `increase_inventory` writer MUST persist all three into the `ModelInventory` record (CREATE or conditional UPDATE).
(Previously: the increase DTO carried only base_price and profit_percentage; VAT never travelled with the inventory write.)

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
(Previously: only base_price and profit_percentage were optional doubles.)

#### Scenario: Proto with values
- GIVEN a MedicationProto is built with base_price, profit_percentage, and vat set
- WHEN it is serialized
- THEN all three optional doubles are encoded as present fields

#### Scenario: Proto without values
- GIVEN a MedicationProto leaves the fields unset
- WHEN it is serialized
- THEN it omits them and existing consumers still decode it

### Requirement: Frontend Inventory Types Carry Optional Pricing Fields
The system MUST define optional `basePrice?: number`, `profitPercentage?: number`, and `vat?: number` on `Medication`, `BulkProductRow`, the `increaseInventory` payload, and the `createProduct` payload.
(Previously: only basePrice and profitPercentage were optional; `vat` was not part of the inventory pricing types.)

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
(Previously: the form had no VAT input and coerced an explicit `0%` VAT into the old `16%` default.)

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

### Requirement: Null Handling Is Safe Everywhere
The system MUST store NULL (not zero, not error) for any insertion point lacking the value, and pricing logic MUST treat NULL as "unknown". NULL MUST stay distinct from an explicit `0`: a NULL VAT is unknown (eligible for fallback), a `0` VAT is a deliberate value.
(Previously: NULL handling covered base_price/profit_percentage; VAT NULL semantics were unspecified.)

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
