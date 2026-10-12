# Proposal: Product Base Price & Profit Fields (Inventory)

## Intent
Add two nullable stored fields to per-pharmacy inventory — `basePrice`/`profitPercentage` (cost/reference price and markup) — and thread them through every inventory insertion/creation point in both repos. Enables future price derivation (`price = basePrice * (1 + profitPercentage)`); for now they are captured where sources provide them and left null where they do not.

## Scope
### In Scope
- Backend `ModelInventory` gains `base_price` + `profit_percentage`; create-medication DTO + inventory-increase DTO (`/Medications/Create`, `/MedicationsAgent/increase`); `MedicationProto` (proto3) gains them; Excel `import-stock`/`import-prices` (`ApplyPharmacyMedicationStockUseCase`) threads them.
- Frontend `modules/products/` types gain `basePrice`/`profitPercentage`; `increaseInventory` input type gains them; `TabCreateProduct` + `StockFeaturesForm` get two inputs; `BulkImportDialog` call site keeps compiling (null/default).

### Out of Scope
- Catalog `ModelMedications`; price-derivation/business logic (future); `stock +=` semantics; prior archived change behavior.

## Capabilities
### New Capabilities
- `inventory-pricing-fields`: Persists `basePrice`/`profitPercentage` (`base_price`/`profit_percentage`) on per-pharmacy inventory across all creation/insertion points in both repos.

### Modified Capabilities
- None (no existing openspec specs).

## Approach
All new fields are `Option<f64>` (nullable) on backend, optional `number` on frontend; default null where sources lack them.

Backend (`Backend-administrativo`):
1. `src/shape/src/models/model_medications.rs` — `ModelInventory` (l.177) + `ModelMedicationsaux` (l.121) add `base_price`/`profit_percentage`; catalog `ModelMedications` unchanged.
2. `src/features/medications_agent/src/adapters/dto.rs` — `IncreaseMedicationItem` (l.19) + `IncreaseInventoryRequest` (l.8) add `base_price`/`profit_percentage`.
3. `src/features/medications_agent/src/adapters/dto.proto` — `MedicationProto` (l.15) add proto3 `optional double base_price`/`profit_percentage` (BREAKING).
4. `.../controllers/increase_inventory.rs` (map l.82-90) — set new fields on `MedicationProto`.
5. `.../controllers/import_prices.rs` (l.33/51) — column mapping threads them (absent → null).

Frontend (`ERP_medizin_web`):
6. `modules/products/types/products.types.ts` — `Medication` + `BulkProductRow` add `basePrice?`/`profitPercentage?`.
7. `modules/products/api/products.service.ts` — `increaseInventory` type (l.152) + `createProduct` payload carry them.
8. `modules/products/hook/useCreateProduct.ts` — `MedicationData` (l.8-28) + medProto build (l.85-104) set them.
9. `modules/products/store/products.store.ts` — `saveMedicine` (l.210) + `addToInventory` (l.163) pass them.
10. `components/TabCreateProduct.tsx` (l.535) — two new inputs.
11. `components/StockFeaturesForm.tsx` (l.190) — two new inputs (distinct from computed "Precio Base (sin IVA)").
12. `components/BulkImportDialog.tsx` (l.192) — pass null/default.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `Backend-administrativo/.../model_medications.rs` | Modified | `ModelInventory` + `ModelMedicationsaux` add `base_price`/`profit_percentage` |
| `Backend-administrativo/.../adapters/dto.rs` | Modified | `IncreaseMedicationItem` + `IncreaseInventoryRequest` add fields |
| `Backend-administrativo/.../adapters/dto.proto` | Modified (BREAKING) | `MedicationProto` adds optional fields |
| `Backend-administrativo/.../increase_inventory.rs` | Modified | DTO→Proto mapping sets new fields |
| `Backend-administrativo/.../import_prices.rs` | Modified | Excel use case threads fields |
| `ERP_medizin_web/modules/products/types/products.types.ts` | Modified | `Medication`/`BulkProductRow` add optional fields |
| `ERP_medizin_web/modules/products/api/products.service.ts` | Modified | `increaseInventory` type + `createProduct` payload |
| `ERP_medizin_web/modules/products/hook/useCreateProduct.ts` | Modified | `MedicationData` + MQTT medProto build |
| `ERP_medizin_web/modules/products/store/products.store.ts` | Modified | `saveMedicine`/`addToInventory` pass fields |
| `ERP_medizin_web/modules/products/components/TabCreateProduct.tsx` | Modified | Two new inputs |
| `ERP_medizin_web/modules/products/components/StockFeaturesForm.tsx` | Modified | Two new inputs |
| `ERP_medizin_web/modules/products/components/BulkImportDialog.tsx` | Modified | Pass null/default at call site |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Proto contract change breaks other consumers | Med | Additive proto3 fields are wire-compatible; regenerate all stubs; coordinate release |
| Cross-repo (2 PRs) drift | Med | `auto-chain` delivery; merge together; shared field names |
| Sources lacking value (Excel, 3rd-party HTTP) | High | Fields nullable; default null; future logic handles null |
| `ModelInventory` mixes camelCase (price) + snake_case (base_price) | Low | Confirm casing in spec; document |
| UI confusion w/ existing "Precio Base (sin IVA)" | Med | Label new inputs clearly (cost / profit %) |

## Rollback Plan
- Backend: revert PR; fields nullable so historical rows harmless; no migration needed (optional: drop columns).
- Frontend: revert PR; optional fields passed as null; no data change.

## Dependencies
- protoc toolchain to regenerate `MedicationProto` stubs.
- Coordinated backend+frontend release (`auto-chain`).

## Success Criteria
- [ ] `ModelInventory` stores nullable `base_price`/`profit_percentage` in SurrealDB
- [ ] `IncreaseInventoryRequest`/`IncreaseMedicationItem`/`MedicationProto` carry fields; `increase_inventory` maps them
- [ ] Excel `import-stock`/`import-prices` threads them (null when missing)
- [ ] Frontend types + `increaseInventory` carry `basePrice`/`profitPercentage`
- [ ] `TabCreateProduct` + `StockFeaturesForm` expose inputs; `BulkImportDialog` compiles with null/default
- [ ] Both PRs merged; proto consumers regenerated; no unknown-field errors
- [ ] No price-derivation logic added (out-of-scope verified)
