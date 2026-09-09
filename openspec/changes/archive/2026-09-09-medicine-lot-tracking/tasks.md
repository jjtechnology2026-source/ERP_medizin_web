# Tasks: Medicine Lot Tracking — Stock Intake (Frontend)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~90–130 (single repo, additive optional field) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending (no chain needed) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Types + service + store + hook + forms + Excel lot plumbing (whole change) | Single PR | `pnpm build` (Next 16 type-check) | Manual: add-stock submit blank vs filled; Excel with/without Lote column | Revert PR; optional field, no migration, sale/catalog payloads untouched |

## Phase 1: Types (Foundation)

- [x] 1.1 (R2) `modules/products/types/products.types.ts`: add `lote?: string` to `Medication` and `BulkProductRow`. AC: existing code type-checks without changes.
- [x] 1.2 (R2) `modules/products/hook/useCreateProduct.ts`: add `lote?: string` to `MedicationData` (l.6-28). AC: optional, no required-field errors.

## Phase 2: Payload Plumbing (Service + Store + Hook)

- [x] 2.1 (R1) `modules/products/api/products.service.ts` (l.156): add `lote?: string | null` to the `increaseInventory` item type. AC: items with/without lote type-check (R1).
- [x] 2.2 (R1) `modules/products/store/products.store.ts`: in `saveMedicine` increase item (l.264-272) add `...(medicine.lote?.trim() ? { lote: medicine.lote.trim() } : {})`. Do NOT touch change-detection (l.257-262). AC: blank lote → item omits key (R1/R3); lot-only edit with q=0 no-ops (R3-sc3).
- [x] 2.3 (R1) `modules/products/hook/useCreateProduct.ts` (l.87-98): add same spread from `payloadData.lote` on the initial-stock increase item; parse `baseData.lote` into `payloadData` (l.47-69) with trim. AC: create with stock>0 + lote sends it; blank omits (R4).

## Phase 3: Forms

- [x] 3.1 (R3) `modules/products/components/StockFeaturesForm.tsx`: add `lote` state (l.25-29), set to `""` on `currentMedicine` change (l.33-55), render optional input in the stock grid (l.270-306), include `lote: lote.trim() || undefined` in the medicine object (l.91-100). AC: filled → forwarded; blank → omitted; never blocks save.
- [x] 3.2 (R4) `modules/products/components/TabCreateProduct.tsx`: add `lote` to `formData` initial state (l.185 area), optional text input in Precio-y-Stock grid (l.544-588), `lote` in submit payload (l.272-283). AC: initial stock + lote → create sends it; blank → omitted (R4).

## Phase 4: Bulk Excel Import

- [x] 4.1 (R5) `modules/products/components/BulkImportDialog.tsx`: template header (l.30-47) + dummy row (l.49-68) gain optional `Lote` column after `Stock`. AC: downloaded template shows column.
- [x] 4.2 (R5) Parse (l.145-163): `const loteRaw = getCol(row, ["Lote", "lote", "LOTE"]); ... lote: loteRaw ? loteRaw.trim() : undefined`. AC: file with column parses lot; legacy file without column parses unchanged (R5-sc2).
- [x] 4.3 (R5) Post-link increase map (l.212-223): add `...(p.lote?.trim() ? { lote: p.lote.trim() } : {})`. AC: stock>0 rows forward lot when present; blank/absent omitted (R5).

## Phase 5: Verification

- [x] 5.1 `pnpm build` passes (type-check all R-references).
- [ ] 5.2 Manual (deferred to browser pass): StockFeaturesForm and TabCreateProduct — submit blank lote → network shows no `lote` key; filled → trimmed value present (R3/R4).
- [ ] 5.3 Manual (deferred to browser pass): BulkImportDialog — legacy Excel (no Lote column) imports without error; file with Lote column forwards lot on increase (R5).
- [x] 5.4 Regression: catalog `POST /Medications/Create` payload and checkout order payload contain no `lote` (R6/R7) — compare network tab before/after.
- [x] 5.5 `pnpm lint` clean.

## Implementation Order

Phase 1 → 2 → 3 → 4 → 5. Types are the compile-enabling foundation; service/store/hook plumbing depends on them; forms and Excel are leaf UI. All changes are additive-optional in one file cluster under `modules/products/`; single PR is revertible with no migration.
