# Archive Report: medicine-lot-tracking (frontend)

**Archived**: 2026-09-09
**Mode**: both (Engram + OpenSpec)
**Verdict**: ARCHIVED — pass with deferred browser checks

## Executive Summary

Frontend capture side of per-lot traceability: an optional `Lote` field on every per-pharmacy stock intake (manual add-stock, product creation with initial stock, bulk Excel import) forwarded on the `increaseInventory` payload. Blank/whitespace lote degrades to the backend SIN LOTE bucket. The sale/checkout flow is intentionally untouched — the backend seals consumed lots onto order lines (see backend change archive `2026-09-09-medicine-lot-tracking`).

## Lifecycle Summary

### Proposed (Engram obs #1805/#1807)
Cross-repo change; frontend scope fixed to intake-only after exploration (checkout payload unchanged; backend owns FIFO + sealing).

### Specified (#1813)
8 requirements / 14 scenarios (`inventory-lot-tracking` capability): optional lot on payload/types/forms/Excel, catalog payload unchanged, sale flow unchanged, plain trimmed text with no expiry semantics.

### Designed (#1814)
Thread optional `lote` through the three intake paths calling `increaseInventory`; single-word key (camelCase `lote`); blank → omit key; Excel `Lote` column optional and legacy-safe.

### Implemented (#1815 + apply-progress)
- PR #7: prerequisite HTTP-increase fix (cherry-picked from never-pushed local `af1e395`)
- PR #8: types/service/store/hook + StockFeaturesForm + TabCreateProduct + BulkImportDialog (13/15 tasks)
- PR #9: R3-sc3 remediation found during verify — lote gated on positive stock delta (prevents phantom 0-stock lot rows)

### Verified (verify-report.md)
8/8 requirements, 14/14 scenarios evidenced; `pnpm build` clean; lint adds no new problem types vs repo baseline.

## Deferred (not blockers)

- Tasks 5.2/5.3: browser network-tab pass before production deploy (blank lote → no key; filled → trimmed value; Excel with/without Lote column)

## Flagged Follow-ups

- Display decision from backend verify: grouped cursor/list rows expose `math::max` scalars without the lot label — ERP web may want a per-lot stock view later
- Frontend must send `producto_tipo=Nuevo` when adding stock to a NEW lot of an existing product (purchase invoices path; flagged in backend apply-progress)

## Rollback Boundary

Revert #8 (+ #9). Optional field, no migration; blank lote equals pre-change behavior server-side.
