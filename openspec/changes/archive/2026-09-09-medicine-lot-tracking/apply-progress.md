# Apply Progress — medicine-lot-tracking (Frontend slice)

**Change**: medicine-lot-tracking
**Mode**: Standard (no test runner in this repo — verification via `pnpm build` type-check + lint + manual browser pass)
**Batch**: Frontend — all 15 tasks (types, plumbing, forms, Excel)
**Date**: 2026-09-09
**Branch**: feat/medicine-lot-tracking (based on feat/http-increase-bind → origin/master)

## Prerequisite note

The stock-intake paths this slice threads `lote` through (Excel import + initial stock at create) only exist because of the HTTP-increase fix (`af1e395`, previously local-only, never pushed). That commit is cherry-picked as `6539fd3` on `feat/http-increase-bind` (PR A); this branch stacks on it (PR B).

## Completed Tasks

- [x] 1.1 `lote?: string` on `Medication` and `BulkProductRow` (products.types.ts)
- [x] 1.2 `lote?: string` on `MedicationData` (useCreateProduct.ts)
- [x] 2.1 `lote?: string | null` on the `increaseInventory` item type (products.service.ts)
- [x] 2.2 `saveMedicine` increase item spreads `...(medicine.lote?.trim() ? { lote: medicine.lote.trim() } : {})`; change-detection untouched (products.store.ts)
- [x] 2.3 `useCreateProduct`: parse `baseData.lote` (trim, blank→undefined) into `payloadData`; spread on the initial-stock increase item; catalog POST receives `catalogPayload = { ...payloadData, lote: undefined }` so `/Medications/Create` stays lote-free (JSON.stringify drops undefined keys)
- [x] 3.1 `StockFeaturesForm`: `lote` state, reset to `""` on `currentMedicine` change, optional input in the stock grid, `lote: lote.trim() || undefined` in the emitted medicine object
- [x] 3.2 `TabCreateProduct`: `lote` in formData init, optional `InputField` in the Precio-y-Stock grid, `lote: formData.lote.trim() || undefined` in submit payload; its Excel template header/dummy row gained the `Lote` column (kept in sync with BulkImportDialog — the known drift bug class from the basePrice/profit incident)
- [x] 4.1 `BulkImportDialog` template header + dummy row: `Lote` after `Stock`
- [x] 4.2 Parse: `getCol(row, ["Lote", "lote", "LOTE"])` → `lote: loteRaw || undefined` (legacy files without the column parse unchanged — getCol returns "")
- [x] 4.3 Post-link increase map: `...(p.lote?.trim() ? { lote: p.lote.trim() } : {})`; `bulkImportWithProgress` passes `lote` into `createProduct` so the returned in-memory `Medication` carries it (the POST payload builder is an explicit whitelist — catalog stays clean)
- [x] 5.1 `pnpm build` → Compiled successfully (type-check across all R-references)
- [ ] 5.2 Manual browser pass (deferred): blank lote → no `lote` key; filled → trimmed value (statically guaranteed by the spreads; needs a live network-tab check)
- [ ] 5.3 Manual browser pass (deferred): legacy Excel (no Lote column) imports; file with Lote column forwards lot
- [x] 5.4 Regression (static): `/Medications/Create` payload excludes `lote` (catalogPayload override; createProduct whitelist); checkout/cash-register untouched (no diffs in modules/orders)
- [x] 5.5 `pnpm lint`: repo baseline is NOT clean (338 pre-existing errors, mostly `no-explicit-any`); the changed files add no new problem types beyond the file-local `(e: any)` InputField handler pattern already used by every sibling field

## Files Changed (7 source + 2 SDD)

| File | Action | What Was Done |
|------|--------|---------------|
| modules/products/types/products.types.ts | Modified | `lote?: string` on Medication + BulkProductRow |
| modules/products/api/products.service.ts | Modified | increaseInventory item type + lote passed into createProduct arg (in-memory carry; POST whitelist unchanged) |
| modules/products/store/products.store.ts | Modified | saveMedicine increase item lote spread; change-detection untouched |
| modules/products/hook/useCreateProduct.ts | Modified | MedicationData.lote, parse+trim, catalog POST lote-stripped, increase spread |
| modules/products/components/StockFeaturesForm.tsx | Modified | lote state + reset + optional input + medicine object |
| modules/products/components/TabCreateProduct.tsx | Modified | formData lote + input + payload + template column |
| modules/products/components/BulkImportDialog.tsx | Modified | template column + parse + increase map spread |
| openspec/changes/medicine-lot-tracking/tasks.md | Modified | 13/15 [x]; 5.2/5.3 deferred to browser pass |
| openspec/changes/medicine-lot-tracking/apply-progress.md | Created | this file |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm build` → ✓ Compiled successfully (Next 16 type-check); `npx eslint` on the 7 changed files → only pre-existing patterns (`(e: any)` handlers, unused `e` catches); the one new warning (`_catalogLote`) was removed by switching to the `lote: undefined` override |
| Runtime harness | N/A — no test runner; deferred items 5.2/5.3 need a browser network-tab pass |
| Rollback boundary | Revert PR B (and PR A independently if the HTTP-increase fix is also unwanted). Optional field, no migration; blank lote omits the key so behavior degrades to SIN LOTE server-side |

## Deviations from Design

- `useCreateProduct` catalog POST: design assumed the whitelist in `createProduct` covered this hook, but the hook posts `payloadData` directly — fixed with an explicit `lote: undefined` override (JSON.stringify omits it).
- `bulkImportWithProgress` now passes `lote` into `createProduct`'s argument (in-memory carry for the increase map). The POST payload builder is an explicit whitelist that ignores `lote`, so the catalog request stays clean (R6/R7).
- TabCreateProduct's own Excel template also gained the `Lote` column (design named only BulkImportDialog; syncing avoids the documented template-drift bug class).

## Issues Found

- None blocking. 5.2/5.3 remain as a browser pass for the user before deploy.

### Status
13/15 frontend tasks complete; 5.2/5.3 deferred to a manual browser network check. Ready for orchestrator delivery (PR B stacked on PR A).
