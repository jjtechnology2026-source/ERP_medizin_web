# Tasks: Excel Bulk Import + Pharmacy Inventory

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~40 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Core Implementation

- [x] 1.1 Fix `controlled`/`antibiotic` column parsing in `BulkImportDialog.tsx` lines 137-138: replace `row["Controlado (SI/NO)"] || row["controlled"]` hardcoded access with `getCol(row, [...]` using Spanish/English fuzzy aliases per spec (`Controlado (SI/NO)` / `controlled` / `CONTROLADO` and `Antibiótico (SI/NO)` / `antibiotic` / `ANTIBIOTICO`)

- [x] 1.2 Add `pharmacyId?: string` to `BulkImportDialogProps` interface (line 8) and destructure in component signature (line 14)

- [x] 1.3 In `handleSave` (after line 170), filter `res.created` products with `stock > 0`, call `productsService.increaseInventory(pharmacyId, filtered)` with `bar_code: product.barCode, stock: product.stock, price: product.price, minimum: product.minimum`. Guard: skip if `!pharmacyId`

- [x] 1.4 Update `result` state type (line 23) to include `inventoryUpdated: number` and set it after inventory call. Update result display (lines 329-338) to show `"X productos creados, Y con inventario actualizado"` or `"X productos creados (inventario no actualizado: falta farmacia)"` when `!pharmacyId`

## Phase 2: Wiring

- [x] 2.1 In `TabCreateProduct.tsx`: import `useAuthStore` from `@/modules/auth/store/useAuthStore`, read `pharmacyId` via `useAuthStore((s) => s.profile?.pharmacyId)`, pass as prop to `<BulkImportDialog pharmacyId={pharmacyId} />`
