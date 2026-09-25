# Archive Report: fix-product-price-update

**Archived**: 2026-09-25
**Mode**: hybrid (Engram + OpenSpec)
**Verdict**: ARCHIVED — `PASS_WITH_WARNINGS`, 0 CRITICAL
**Repos**: `/home/enzo/medizin/ERP_medizin_web` (FE) + `/home/enzo/medizin/Backend-administrativo` (BE)
**Native review**: `reviewGate` structurally absent — receipt-driven development is off for this clone (`gentle-ai review mode status` → `off (decided by default)`). No review artifact was ever discovered for this candidate; archive proceeds under ordinary repository policy.

## Executive Summary

An existing product's price edit reported success in the UI but never persisted the new price. Four independent root causes were fixed: **A** the create/submit paths gated the price-carrying `increaseInventory` write on `stock > 0`; **B** `saveMedicine` resolved existence against the in-memory current page (10 rows) so catalog-sourced products were treated as NEW and the inventory write was skipped; **C** the listing exposes `math::max(price)` while a no-lote edit wrote only the SIN LOTE row, so a LOWER price never won MAX; **D** the MQTT echo re-added a delta already applied optimistically.

A/B/D are frontend contract fixes in `modules/products/` behind a pure, unit-testable helper layer (`modules/products/lib/inventory-write.ts`). C is a backend **write-propagation** fix: a no-lote `increase` item with `price > 0` propagates `price`/`base_price`/`profit_percentage`/`discount` to every `(pharmacy_id, product_id)` inventory row while `stock`/`minimum`/`lote`/`expiry` stay row-scoped. No migration, no schema change, no new endpoint, no DTO/proto change.

## Lifecycle Summary

| Phase | Artifact | Engram obs |
|---|---|---|
| Explore | `exploration.md` | #2475 |
| Propose | `proposal.md` | #2476 |
| Spec | `specs/*/spec.md` | #2477 |
| Design | `design.md` | #2479 |
| Tasks | `tasks.md` | #2480 |
| Apply | apply-progress | #2482 |
| Verify | `verify-report.md` | #2489 |

### Verification (final)

`PASS_WITH_WARNINGS` — 11/11 requirements, 15/28 scenarios COMPLIANT and 13/28 PARTIAL, **0 untested/failing, 0 CRITICAL**. The first verify run returned `FAIL` driven by one CRITICAL (the core acceptance path had no runtime proof); it was remediated by the BE runtime integration proof commit and re-verified. The superseding `verify-report.md` is the current verdict; the earlier FAIL is preserved only as history in its Remediation Delta section.

Runtime acceptance was proven end-to-end at the HTTP/repository/DB layer with the **real** `POST /MedicationsAgent/increase` and **real** `GET /Pharmacy/{id}/medications/cursor` controllers over real repositories against a **local** SurrealDB: multi-lot product at 1500 → no-lote zero-stock decrease to 1100 → listing returns 1100, lot labels `L-2026-01`/`L-2026-02` preserved, no new lot row. Production was never contacted (the E2E runner refuses any non-localhost URL).

### Delivery (final)

| Repo | Branch | Commit | Scope | PR |
|---|---|---|---|---|
| FE `ERP_medizin_web` | `fix/price-update-fe-helpers` | `7d5005a8b2ea69560fec7d8099d3a29c08e9adcc` | pure inventory-write helpers + 23 tests + `test:inventory` script | **#24** → `master` |
| FE `ERP_medizin_web` | `fix/price-update-fe-wiring` | `f9897ec5201facd389513cccb665846c770da270` | wiring A/B/D + error surfacing | **#25** (stacked on #24's branch; auto-retargets to `master`) |
| BE `Backend-administrativo` | `fix/price-update-be-propagation` | `a92274e2f0a67b920684e4cc8edeb73f3765d732` | no-lote price propagation (feature) | **#57** → `dev` |
| BE `Backend-administrativo` | `fix/price-update-be-propagation` | `f69e353eea1a316c9a45e2498e9a97e83e23c2e2` | runtime integration proof (E2E test + runner) | **#57** |

All commits are pushed. **No PR is merged yet** (FE #25 depends on #24 landing first).

### Test evidence (final)

- FE `npm run test:inventory`: **23/23 passed**, exit 0.
- FE `npm run test:pricing`: **11/11 passed** (derivation unchanged).
- FE `npx tsc --noEmit`: clean; FE `npm run build`: success (Next.js 16.1.5, 17/17 static pages).
- BE `cargo test -p medications_agent -p phamacy_action`: **45 + 41 passed, 0 failed** (17 + 14 ignored).
- BE DB-backed `--ignored` suites: `medications_agent` **17/17**; `phamacy_action` **13/14** (the single failure is pre-existing, reproduced at base `dev` `6a19a97e`).
- BE E2E: **1/1 passed**, reproduced twice.

## Specs Synced

| Domain | Action | Details |
|---|---|---|
| `inventory-price-persistence` | **Created** | New capability. 6 requirements / 13 scenarios (PERSIST-1..6). |
| `inventory-pricing-fields` | **Updated** | 2 requirements MODIFIED (`TabCreateProduct Exposes Pricing Inputs`, `StockFeaturesForm Exposes Pricing Inputs`; each gained a zero-stock-delta scenario) + 1 requirement ADDED (`Bulk Import Persists Pricing Without Positive Stock`, 3 scenarios). 10→11 requirements, 20→25 scenarios. |
| `inventory-lot-tracking` | **Updated** | 1 requirement MODIFIED (`StockFeaturesForm Captures Lot on Add-Stock`; gained the zero-delta "price-only edit" scenario) + 1 requirement ADDED (`No-Lote Writes Do Not Fabricate Lot Labels`, 2 scenarios). 8→9 requirements, 15→18 scenarios. |

### Sync method (audit)

- New capability: the delta file was copied **mechanically** with the shell (`cp` → `diff -r` → `mv`); the copy produced an empty `diff -r` and matching md5 (`344fa197c59d1fbab63b8b94f9e3dec5`). The copied main spec was then normalized to repo convention with two controlled edits: title (`# Delta for …` → `# Inventory Price Persistence Specification`), a `## Purpose` section, and `## ADDED Requirements` → `## Requirements`. No requirement or scenario text was altered.
- Modified capabilities: `MODIFIED` requirement blocks were replaced in place (including their preserved scenarios) and `ADDED` requirements were appended inside the `## Requirements` section, ahead of the trailing `## Archive Note`. All other requirements were preserved untouched.
- Delta-only `(Previously: …)` history annotations were **dropped** from the merged main specs because the repository's existing source-of-truth specs carry no such annotations (verified: `grep -rn "Previously" openspec/specs/` → none). The annotations remain verbatim in this archived change folder's delta specs.

## Task Completion Reconciliation

All **19 implementation tasks** (`1.1–1.4`, `2.1–2.9`, `3.1–3.6`) are checked `[x]` in the persisted `tasks.md`; the Task Completion Gate therefore passes on the implementation task set, and **no checkbox was rewritten** during archive (sdd-apply owns checkbox completion).

The persisted `tasks.md` still carries unchecked **Phase 4 verification/delivery** items (`4.1–4.4`) and the **spec verification map** (`V1–V11`). These are verification/delivery checkpoints, not implementation tasks, and are carried forward as historical record — matching the repo convention (`2026-09-09-medicine-lot-tracking` archived with its Phase 5 browser checks unchecked and recorded as deferred). Their final state, per the launch prompt's final-state facts (which outrank the intermediate apply-progress snapshot):

- `4.1` FE `test:inventory` from a clean checkout — ✅ complete (23/23).
- `4.2` BE `cargo test` + `-- --ignored` — ✅ complete (45+41 unit; 17/17 + 13/14 DB; 1 pre-existing failure).
- `4.3` Manual E2E (lower to 1100 → cursor returns 1100) — ⚠️ **server half proven** by the E2E integration test; the literal browser UI half was not executed.
- `4.4` One PR per repo — ✅ complete (FE #24, FE #25, BE #57 opened; none merged).
- `V1–V11` — covered by `verify-report.md` (15/28 scenarios COMPLIANT, 13/28 PARTIAL).

## Residual Risks (recorded, not hidden)

1. **FE store seam has no automated coverage.** `saveMedicine` server-side existence resolution (`findInventoryItem` strict), the strict rethrow, the optimistic revert, and the `false`-on-failure contract are verified by source inspection plus helper-level unit tests only. (WARNING 1)
2. **`/admin` JWT/role auth not exercised** by the in-process E2E harness; it mounts the real controllers without the `/admin` scope, so production authorization remains untested by this proof. (WARNING 2)
3. **`products.store.ts:366` stamps `recentMutations` on a FAILED write** (inventory reverted). A legitimate MQTT echo within the following 5s window could be suppressed until refresh. Matches design D5 literally; latent staleness risk. (WARNING 3)
4. **Propagation overwrites per-lot `base_price`/`profit_percentage`/`discount` with `NONE`** when a no-lote edit omits them (design open question Q4). Flagged for product confirmation. (WARNING 4)
5. **Reporting-consumers scenario partially verified** — PDF render and the numeric post-propagation `valor_venta` are not asserted (only SQL shape and DB-level exercises). (WARNING 5)
6. **`phamacy_action` ignored suite has one pre-existing failure** (`catalog_enrichment_reports_real_stock_and_new_state` on a fresh local DB), reproduced at base `6a19a97e` — not caused by this change. (WARNING 6)
7. **`sdd-verify-validate` is unavailable in `gentle-ai 3.2.1`** (its help renders the command with an empty name; no invocable spelling). Verify-report admission could not be proven; the report was persisted per the orchestrator's explicit hybrid-store contract. (WARNING 7)

### Suggestions (non-blocking)

- Add a thin FE integration test for `saveMedicine` covering found-on-server, strict rethrow, and revert-on-failure.
- Add a FE unit case for "positive delta + blank lot ⇒ no `lote` key".
- Do not stamp `recentMutations` when the write fails.
- Confirm the per-lot `NONE` overwrite behavior (Q4) with the operator/product owner.
- Run the literal browser UI acceptance flow before production release.

## Rollback Boundary

Revert the frontend PRs #24/#25 (`master`) and the backend PR #57 (`dev`). No migration, no schema change, no feature flag, and no DTO/proto change. The `increase` contract is backward-compatible; existing divergent multi-lot rows self-heal on the next product-level edit (an optional backfill is deferred). Snapshot pre-edit rows before applying C if multi-row concerns arise.

## Source of Truth Updated

- `openspec/specs/inventory-price-persistence/spec.md` — **created** (6 requirements / 13 scenarios).
- `openspec/specs/inventory-pricing-fields/spec.md` — **updated** (11 requirements / 25 scenarios).
- `openspec/specs/inventory-lot-tracking/spec.md` — **updated** (9 requirements / 18 scenarios).

## Archive Contents

- `proposal.md` ✅
- `exploration.md` ✅
- `specs/inventory-price-persistence/spec.md` ✅ (delta)
- `specs/inventory-pricing-fields/spec.md` ✅ (delta)
- `specs/inventory-lot-tracking/spec.md` ✅ (delta)
- `design.md` ✅
- `tasks.md` ✅ (19/19 implementation tasks complete; Phase 4 / V-map verification items carried as historical record)
- `verify-report.md` ✅ (final `PASS_WITH_WARNINGS`, 0 CRITICAL)
- `archive-report.md` ✅ (this file, additive)

## SDD Cycle Complete

Explored → proposed → specified → designed → implemented (3 slices across 2 repos, 4 commits) → verified (FAIL → remediated with runtime proof → `PASS_WITH_WARNINGS`) → archived. Ready for the next change.
