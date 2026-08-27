# Design: Product Base Price & Profit Fields (Inventory)

## Technical Approach

Add two **nullable** pricing fields — `basePrice`/`profitPercentage` (frontend camelCase; backend `base_price`/`profit_percentage`) — to the **per-pharmacy inventory** only, and thread them through all six inventory insertion points across both repos. No price-derivation logic is added. Proto3 change is additive (wire-compatible) but regenerates generated stubs.

Honored decisions: English naming; both UI forms (`TabCreateProduct` + `StockFeaturesForm`); `ModelInventory` + `ModelMedicationsaux` only (NOT catalog `ModelMedications`); nullable `Option<f64>` / `number?`; null where source lacks value.

## Architecture Decisions

| Decision | Options | Choice |
|----------|---------|--------|
| Naming | Spanish `precio_base` vs English | English (convention in 100% of fields): camelCase on models/TS, snake_case on agent DTO + proto |
| Placement | Catalog vs inventory vs both | Inventory only (`ModelInventory` + `ModelMedicationsaux`); mirrors where `price` already lives |
| Nullability | Required vs optional | Optional everywhere; default null where source lacks value |
| Proto strategy | New message vs additive fields | Additive `optional double` to existing `MedicationProto` (proto3) — existing consumers decode fine |

## Data Model (Backend `model_medications.rs`)

```rust
// ModelInventory (per-pharmacy) — add:
pub base_price: Option<f64>,
pub profit_percentage: Option<f64>,

// ModelMedicationsaux (Create payload) — add:
pub base_price: Option<f64>,
pub profit_percentage: Option<f64>,
```
`ModelMedications` (catalog) is **unchanged**.

**SurrealDB storage / migration assumption:** SurrealDB is schemaless by default, so adding optional Rust fields needs **no migration** — records simply gain the keys. *If the `inventory` table is schemaful*, run (table name to be confirmed):
```sql
DEFINE FIELD base_price ON TABLE {inventory_table} TYPE option<number>;
DEFINE FIELD profit_percentage ON TABLE {inventory_table} TYPE option<number>;
```
No data backfill required; historical rows read as NULL.

## Backend DTO + Mapping (`medications_agent`)

```rust
// dto.rs — IncreaseInventoryRequest.medications[i]:
pub struct IncreaseMedicationItem {
    pub bar_code: String,
    pub stock: f64,
    pub price: f64,
    pub base_price: Option<f64>,        // NEW
    pub profit_percentage: Option<f64>, // NEW
    pub discount: Option<f64>,
    pub minimum: f64,
}
```
`ModelMedicationsaux` (Create `Vec<>` payload) also gains `base_price`/`profit_percentage`.

- **`increase_inventory.rs`** (map l.82-90): set `base_price`/`profit_percentage` on the built `MedicationProto` from the item; absent → `None`.
- **`import_prices.rs`** → `ApplyPharmacyMedicationStockUseCase`: read the two Excel columns; if absent → `None` (NULL).

## Proto (`dto.proto`)

```proto
message MedicationProto {
  // ... existing fields through discount = 18
  optional double base_price = 19;
  optional double profit_percentage = 20;
}
```
**Regeneration:** `protoc --ts_out=... --rust_out=... src/features/medications_agent/src/adapters/dto.proto` (or `buf generate`). This is a **breaking change for generated code** (struct gains fields) though wire-compatible.

**Consumers that must recompile / regenerate:**
1. `medications_agent` crate (handler + use cases) — Rust generated stub.
2. Backend MQTT inventory subscriber that writes `ModelInventory`.
3. Frontend `@/proto/interfaces/dto` (`DtoUpdateMedications`/`MedicationProto` TS interface) — `useCreateProduct.ts` builds `medProto` and calls `DtoUpdateMedications.encode`. Add `base_price`/`profit_percentage` to the generated TS.

## Frontend Threading (`ERP_medizin_web`)

- `products.types.ts`: `Medication` + `BulkProductRow` gain `basePrice?: number; profitPercentage?: number;`
- `products.service.ts`: `increaseInventory` input type gains `basePrice?`/`profitPercentage?`; `createProduct(Partial<Medication>)` inherits them.
- `useCreateProduct.ts`: `MedicationData` gains fields; `medProto` object (l.85-104) sets `basePrice`/`profitPercentage` (protobuf encodes to `base_price`/`profit_percentage`).
- `products.store.ts`: `saveMedicine` (l.210) passes them to `createProduct`+`increaseInventory`; `addToInventory` (l.163) carries them in local merge.
- `TabCreateProduct.tsx` (l.535): add **Base Price ($)** + **Profit (%)** inputs → `createMedication`.
- `StockFeaturesForm.tsx` (l.190): add two inputs **distinct** from computed "Precio Base (sin IVA)" display → `saveMedicine`.
- `BulkImportDialog.tsx` (l.192): pass `null`/`undefined` (future Excel columns).

## Validation Rules

**Assumption (user said "porcentaje"):** `profit_percentage` is a **fraction `0.0–1.0`** (e.g. `0.20` = 20%). `basePrice >= 0`. Both nullable.

- **Frontend (form-level):** inputs accept empty → `undefined`/`null`; if numeric, clamp `profit_percentage` to `[0, 1]` and `basePrice >= 0` before submit.
- **Backend (DTO guard):** in `IncreaseMedicationItem`/`ModelMedicationsaux` deserialization or use-case, reject `profit_percentage > 1.0 || < 0` and `base_price < 0` with `400`; allow `None`.

## Data Flow

```
TabCreateProduct ─┐
StockFeaturesForm─┼─▶ products.store / useCreateProduct ─▶ POST /Medications/Create
BulkImportDialog ─┘                                   └─▶ MQTT MedicationProto (base_price/profit_percentage)
HTTP IncreaseInventoryRequest ─▶ increase_inventory.rs ─▶ MedicationProto ─▶ MQTT insert_inventory
Excel import ─▶ ApplyPharmacyMedicationStockUseCase ─▶ MedicationProto ─▶ inventory record (NULL if absent)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `Backend-administrativo/.../model_medications.rs` | Modify | `ModelInventory` + `ModelMedicationsaux` add `Option<f64>` fields |
| `Backend-administrativo/.../adapters/dto.rs` | Modify | `IncreaseMedicationItem` + `IncreaseInventoryRequest` add fields |
| `Backend-administrativo/.../adapters/dto.proto` | Modify | `MedicationProto` adds fields 19/20 (regenerate stubs) |
| `Backend-administrativo/.../increase_inventory.rs` | Modify | DTO→Proto mapping sets new fields |
| `Backend-administrativo/.../import_prices.rs` | Modify | Excel use case threads fields (null if absent) |
| `ERP_medizin_web/modules/products/types/products.types.ts` | Modify | `Medication`/`BulkProductRow` optional fields |
| `ERP_medizin_web/modules/products/api/products.service.ts` | Modify | `increaseInventory` + `createProduct` payloads |
| `ERP_medizin_web/modules/products/hook/useCreateProduct.ts` | Modify | `MedicationData` + medProto build |
| `ERP_medizin_web/modules/products/store/products.store.ts` | Modify | `saveMedicine`/`addToInventory` pass fields |
| `ERP_medizin_web/modules/products/components/TabCreateProduct.tsx` | Modify | Two inputs |
| `ERP_medizin_web/modules/products/components/StockFeaturesForm.tsx` | Modify | Two inputs (distinct from computed display) |
| `ERP_medizin_web/modules/products/components/BulkImportDialog.tsx` | Modify | Pass null/default |
| `ERP_medizin_web/modules/proto/interfaces/dto.ts` | Regenerate | TS proto gains fields |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | DTO guard rejects invalid fraction/negative | Rust test on `IncreaseMedicationItem` |
| Unit | Proto round-trip with/without fields | encode→decode, assert None when unset |
| Integration | Excel missing columns → NULL | `ApplyPharmacyMedicationStockUseCase` test |
| E2E | UI enters values / leaves blank | Playwright: submit blank → null payload |

## Threat Matrix

`N/A` — no routing, shell, subprocess, VCS/PR-automation code, executable-file classification, or process-integration boundary is introduced by this change. (Delivery uses `auto-chain`, but that is release orchestration, not in-scope code.)

## Migration / Rollout

No data migration. Two coordinated PRs via `auto-chain`:
1. **Backend first** — `ModelInventory`/`ModelMedicationsaux` + DTO + proto + regenerate stubs; proto consumers recompile.
2. **Frontend second** — TS types + UI + regenerated `@/proto/interfaces/dto`.
Shared field names (`base_price`/`profit_percentage`, `basePrice`/`profitPercentage`) are the contract; merge together; verify no unknown-field errors. Rollback = revert either PR (nullable fields leave historical rows harmless).

## Edge Cases

- Excel without the columns → `None` (NULL), no error.
- 3rd-party HTTP `IncreaseInventoryRequest` without fields → `None`.
- `BulkImportDialog` → `null` until future Excel columns exist.
- **Reading NULL must NOT assume 0** — every consumer treats NULL as "unknown" (future derivation logic).

## Open Questions

- [ ] Confirm exact SurrealDB table name for `ModelInventory` (for the optional `DEFINE FIELD` command).
- [ ] Confirm `profit_percentage` fraction semantics (0.0–1.0) is acceptable vs percentage integer (0–100).
