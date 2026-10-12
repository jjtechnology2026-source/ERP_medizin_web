# Archive Report: Excel Bulk Import + Pharmacy Inventory

**Change**: `excel-bulk-import-pharmacy-inventory`
**Date**: 2026-08-11
**Archive Status**: ❌ **BLOCKED**
**Blocker**: 1 CRITICAL finding in `verify-report.md` — no test infrastructure, 0/9 spec scenarios covered

---

## Blocked Reason

Per `sdd-archive` skill: "CRITICAL issues in `verify-report` always block archive. Do not accept an override for CRITICAL verification issues."

The `verify-report.md` records `critical_findings: 1` with verdict `fail`:
> "No test infrastructure exists in this project (no vitest, jest, or any test runner). All 9 spec scenarios lack automated test coverage."

This is a **pre-existing project condition**, not a regression introduced by this change. The implementation code is verified correct at the static level — all 5 requirements and 9 scenarios match. TypeScript compiles with 0 errors. All 5 tasks are complete per `tasks.md` (all `[x]`).

**What MUST happen to unblock**:
1. Install a test framework (e.g., `vitest`) in the project.
2. Write covering tests for the 9 spec scenarios.
3. Re-run `sdd-verify` to produce a passing `verify-report.md` (0 critical findings).
4. Re-run `sdd-archive`.

OR: the project maintainer must explicitly decide to accept the CRITICAL as a known/acknowledged gap (no test infrastructure is a systemic issue, not a per-change gate). In that case, the CRITICAL should be downgraded in the verify report, or a project-level waiver should be recorded in `openspec/config.yaml`.

---

## Executive Summary

This change wires pharmacy inventory creation into the existing Excel bulk import flow. Three frontend-only fixes in `BulkImportDialog.tsx` and `TabCreateProduct.tsx`:

1. **Fix column parsing**: `controlled`/`antibiotic` columns now use the same `getCol()` fuzzy matcher as all other columns, supporting Spanish (`Controlado (SI/NO)`), English (`controlled`), and uppercase (`CONTROLADO`) headers.
2. **Accept `pharmacyId` prop**: `BulkImportDialog` receives an optional `pharmacyId` from the auth store, enabling per-pharmacy inventory operations.
3. **Call `increaseInventory()` after import**: After `bulkImportWithProgress` succeeds, products with `stock > 0` trigger `productsService.increaseInventory()` — the existing endpoint that resolves barCode → product_id and handles INSERT vs UPDATE.

Zero backend changes. Zero new endpoints. 44 lines added across 2 source files.

---

## Change Lifecycle

| Phase | Artifact | Status |
|-------|----------|--------|
| Proposal | `proposal.md` | ✅ Complete |
| Spec | `specs/excel-bulk-import/spec.md` | ✅ Complete (5 requirements, 9 scenarios) |
| Design | `design.md` | ➖ Not created (change is wiring-only, no architecture) |
| Tasks | `tasks.md` | ✅ 5/5 tasks complete (all `[x]`) |
| Apply | Implementation | ✅ 44 lines, 2 source files, 0 TS errors |
| Verify | `verify-report.md` | ❌ `fail` — 1 CRITICAL (no test infra) |
| Archive | This report | ❌ BLOCKED by CRITICAL finding |

---

## Implementation Summary

### Files Changed

| File | Lines | Changes |
|------|-------|---------|
| `modules/products/components/BulkImportDialog.tsx` | +38 / -7 | Fix column parsing (1.1), add pharmacyId prop (1.2), inventory call (1.3), result display (1.4) |
| `modules/products/components/TabCreateProduct.tsx` | +3 / -0 | Import useAuthStore, read pharmacyId, pass as prop (2.1) |
| `.atl/skill-registry.md` | +3 / -2 | Metadata update (not part of the change) |

### Build Verification

```
npx tsc --noEmit → exit 0, no errors
```

### Task Completion

| Task | Requirement | Lines | Verified |
|------|-------------|-------|----------|
| 1.1 | REQ-01: Fuzzy Column Parsing | 139-140 | ✅ `getCol(["Controlado (SI/NO)", "controlled", "CONTROLADO"])` |
| 1.2 | REQ-03: Pharmacy ID Requirement | 12, 19 | ✅ `pharmacyId?: string` in interface + destructure |
| 1.3 | REQ-02: Pharmacy Inventory Creation | 177-199 | ✅ Filters stock>0, calls `increaseInventory()`, try/catch |
| 1.4 | REQ-04: Import Result Display | 25, 201, 362-367 | ✅ `inventoryUpdated` field + 3 message variants |
| 2.1 | REQ-03: Wiring | 6, 128, 596 | ✅ `useAuthStore` import, read, pass prop |

### Spec Compliance (Static Review)

| Requirement | Scenarios | Status |
|-------------|-----------|--------|
| REQ-01: Fuzzy Column Parsing | Spanish headers, English headers, empty/missing | ✅ Implemented |
| REQ-02: Pharmacy Inventory Creation | Products with stock, products without stock | ✅ Implemented |
| REQ-03: Pharmacy ID Requirement | pharmacyId provided, pharmacyId undefined | ✅ Implemented |
| REQ-04: Import Result Display | Successful, partial failure, missing pharmacy | ✅ Implemented |
| REQ-05: Existing Product Handling | Re-import dedup | ✅ Relies on backend |

---

## Delta Specs for Main Spec Sync (DEFERRED)

The following delta spec would be synced to `openspec/specs/excel-bulk-import/spec.md` when archive unblocks:

| Domain | Action | Details |
|--------|--------|---------|
| `excel-bulk-import` | CREATE | 5 requirements, 9 scenarios — new domain, no main spec exists |

**Delta content**: `openspec/changes/excel-bulk-import-pharmacy-inventory/specs/excel-bulk-import/spec.md`

Since the main spec path `openspec/specs/excel-bulk-import/spec.md` does not exist, the delta IS the full spec and would be copied directly.

---

## Risks

| Risk | Severity | Status |
|------|----------|--------|
| `increase_inventory` uses `stock +=` (additive) — re-import doubles inventory | High | Documented. No mitigation implemented (out of scope). Future: SET-mode endpoint. |
| `pharmacyId` undefined if auth profile lacks it | Medium | Guarded: `if (pharmacyId && ...)` skips inventory call, warning shown. |
| No automated tests for 9 scenarios | **CRITICAL** | Pre-existing project condition. Blocks archive per SDD rules. |
| Extra guard `p.quantity > 0` in stock filter | Low (minor deviation) | Safe defensive check, improves robustness. |

---

## Artifact Inventory

| Artifact | Path | Engram Topic Key |
|----------|------|-----------------|
| Proposal | `openspec/changes/excel-bulk-import-pharmacy-inventory/proposal.md` | `sdd/excel-bulk-import-pharmacy-inventory/proposal` |
| Spec | `openspec/changes/excel-bulk-import-pharmacy-inventory/specs/excel-bulk-import/spec.md` | `sdd/excel-bulk-import-pharmacy-inventory/spec` |
| Tasks | `openspec/changes/excel-bulk-import-pharmacy-inventory/tasks.md` | `sdd/excel-bulk-import-pharmacy-inventory/tasks` |
| Verify Report | `openspec/changes/excel-bulk-import-pharmacy-inventory/verify-report.md` | `sdd/excel-bulk-import-pharmacy-inventory/verify-report` |
| Archive Report | `openspec/changes/excel-bulk-import-pharmacy-inventory/archive-report.md` | `sdd/excel-bulk-import-pharmacy-inventory/archive-report` |

---

## Next Steps

1. **Unblock**: Install test framework (e.g., `vitest`) and write covering tests for the 9 spec scenarios, OR record a project-level test-infra waiver in `openspec/config.yaml`.
2. **Re-verify**: Run `sdd-verify` to produce a passing report.
3. **Re-archive**: Run `sdd-archive` to sync delta specs to main specs and move the change folder to `openspec/changes/archive/2026-08-11-excel-bulk-import-pharmacy-inventory/`.
