# Tasks: Product Base Price & Profit Fields (Inventory)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300–400 (Backend ~140–190, Frontend ~160–210) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | Backend PR (SLICE 1) → Frontend PR (SLICE 2) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Backend model+DTO+proto+controllers+Excel+guard | Backend PR | `cargo test -p medications_agent` | `cargo build` + proto regen | Backend repo files only |
| 2 | Frontend types+service+hook+store+forms+proto TS | Frontend PR | `npx vue-tsc --noEmit` | `npm run dev` manual form submit | Frontend repo files only |

## Phase 1: Backend Slice (SLICE 1 — repo Backend-administrativo)

- [ ] B1 (R1) `src/shape/src/models/model_medications.rs`: add `pub base_price: Option<f64>`, `pub profit_percentage: Option<f64>` to `ModelInventory` (l.177) + `ModelMedicationsaux` (l.121); `ModelMedications` unchanged. AC: compiles; catalog unaffected.
- [ ] B2 (R2,R3) `src/features/medications_agent/src/adapters/dto.rs`: same two `Option<f64>` fields on `IncreaseMedicationItem` (l.19) + `IncreaseInventoryRequest` (l.8). AC: payload deserializes with/without fields (R2/R3).
- [ ] B3 (R4) `src/features/medications_agent/src/adapters/dto.proto`: add `optional double base_price = 19;` + `optional double profit_percentage = 20;` to `MedicationProto`; regenerate Rust stub via protoc/buf. AC: generated struct gains fields; existing consumers decode (R4).
- [ ] B4 (R3) `.../controllers/increase_inventory.rs` (map l.82-90): set `base_price`/`profit_percentage` on built `MedicationProto` from item; absent→None. AC: increase with/without pricing maps correctly.
- [ ] B5 (R5) `.../controllers/import_prices.rs` (`ApplyPharmacyMedicationStockUseCase`): read the two Excel columns; if absent→None. AC: columns present→values; absent→NULL (R5).
- [ ] B6 (R10) `dto.rs` + unit test: reject `profit_percentage > 1.0 || < 0` and `base_price < 0` with 400; allow None. AC: invalid fraction/negative → 400; None passes (R10).

## Phase 2: Frontend Slice (SLICE 2 — repo ERP_medizin_web)

- [x] F1 (R6) `modules/products/types/products.types.ts`: add `basePrice?: number; profitPercentage?: number;` to `Medication` + `BulkProductRow`. AC: types compile optional.
- [x] F2 (R6) `modules/products/api/products.service.ts`: `increaseInventory` input type + `createProduct` payload carry `basePrice?`/`profitPercentage?`. AC: payloads omit when undefined (R6).
- [x] F3 (R4) `@/proto/interfaces/dto.ts` (regenerate): `MedicationProto`/`DtoUpdateMedications` gains `base_price`/`profit_percentage`. AC: TS compiles against backend proto fields.
- [x] F4 (R6) `modules/products/hook/useCreateProduct.ts`: `MedicationData` gains fields; `medProto` build (l.85-104) sets them. AC: encode carries values/absent.
- [x] F5 (R6) `modules/products/store/products.store.ts`: `saveMedicine` (l.210) + `addToInventory` (l.163) pass fields. AC: store forwards null-safe.
- [x] F6 (R7) `modules/products/components/TabCreateProduct.tsx` (l.535): add Base Price + Profit % inputs → `createMedication`; empty→null. AC: submit blank → null payload (R7).
- [x] F7 (R8) `modules/products/components/StockFeaturesForm.tsx` (l.190): two inputs distinct from computed "Precio Base (sin IVA)" → `saveMedicine`. AC: computed display unchanged when blank (R8).
- [x] F8 (R9) `modules/products/components/BulkImportDialog.tsx` (l.192): pass `null`/`undefined` for the two fields. AC: builds & type-checks (R9).

## Phase 3: Verification (both slices)

- [ ] V1 Backend: `cargo test -p medications_agent` + proto round-trip test (with/without fields).
- [ ] V2 Frontend: `npx vue-tsc --noEmit` typecheck; manual Playwright submit-blank → null payload.

## Implementation Order

Backend first (B1→B3→B2→B4→B5→B6): model + proto are compile-enabling foundations; DTO and controllers depend on them. Frontend second (F1→F2→F3→F4→F5→F6/F7→F8): types + service + regenerated proto are foundations; hook/store depend on them; forms + BulkImportDialog are leaf UI. Each slice is independently verifiable and revertible (stacked-to-main in its own repo).
