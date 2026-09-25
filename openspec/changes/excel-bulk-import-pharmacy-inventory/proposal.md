# Proposal: Excel Bulk Import + Pharmacy Inventory

## Intent

Bulk Excel import creates products in the catalog but never inserts them into the importing pharmacy's inventory. The user uploads an Excel with `Stock` and `Precio (USD)` columns expecting catalog + inventory creation. We close that gap by calling the already-working `increaseInventory` endpoint after catalog creation, and fix two frontend bugs that block the flow.

## Scope

### In Scope
- Fix `controlled`/`antibiotic` column parsing in `BulkImportDialog.tsx` (bug: bypasses fuzzy `getCol()` matcher)
- Pass `pharmacyId` into `BulkImportDialog` via `pharmacyId` prop
- Call `productsService.increaseInventory()` after `bulkImportWithProgress` completes in `handleSave`

### Out of Scope
- Backend changes (Rust/SurrealDB catalog or inventory)
- Fixing N+1 HTTP pattern in `bulkImportWithProgress`
- Fixing `aux_to_product` dropping `minimum`/`discount`
- Creating a new bulk endpoint
- Changing `stock +=` to `stock =` in backend `increase_inventory`

## Capabilities

### New Capabilities
None — existing capabilities, behavior gap.

### Modified Capabilities
None — no spec-level requirement changes. This is a wiring fix.

## Approach

Minimal frontend-only wiring. Two changes in `BulkImportDialog.tsx`, zero in `products.service.ts`.

1. **Add `pharmacyId` prop**: `BulkImportDialogProps` gets `pharmacyId?: string`
2. **Fix column parsing**: Replace lines 137-138 hardcoded column access with `getCol()` calls using Spanish/English aliases
3. **Inventory call after import**: In `handleSave`, after `bulkImportWithProgress` returns, call `increaseInventory(pharmacyId, filteredProducts)` for products with `stock > 0`

`increaseInventory` already resolves barCode → product_id internally, handles INSERT vs UPDATE, and the `products.service.ts` method already exists (line 135). No new backend code needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `modules/products/components/BulkImportDialog.tsx` | Modified | Add `pharmacyId` prop, fix controlled/antibiotic parsing, add inventory call |
| `modules/products/components/` (callers) | Modified | Pass `pharmacyId` from auth context wherever `BulkImportDialog` is rendered |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `increase_inventory` uses `stock +=` (additive) — re-importing same Excel doubles inventory | High | Document this behavior. Add a warning note in dialog. Future: SET-mode endpoint |
| Backend `/Medications/Create` returns no structured IDs — can't validate 1:1 product creation | Low | `increaseInventory` resolves barCode → product_id internally, so backend self-heals |
| `pharmacyId` may be undefined if user's auth profile lacks it | Medium | Guard: skip inventory call if `!pharmacyId`, show warning |

## Rollback Plan

Revert the 2 modified files. No database migrations, no backend changes.

## Dependencies

- Auth context must expose `pharmacyId` on user profile (already available via `useAuthStore.getState().profile?.pharmacyId`)
- Backend `/admin/MedicationsAgent/increase` must remain operational (already tested, working)

## Success Criteria

- [ ] Excel with `Stock` and `Precio (USD)` creates products in catalog AND inventory for the importing pharmacy
- [ ] `controlled`/`antibiotic` columns parse correctly regardless of header variation (e.g., `Controlado (SI/NO)` vs `controlled`)
- [ ] Import without pharmacy context shows a clear warning, not a crash
