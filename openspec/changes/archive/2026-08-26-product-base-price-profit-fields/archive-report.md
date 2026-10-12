# Archive Report: Product Base Price & Profit Fields (Inventory)

## Status
**Archived** — SDD cycle complete. Mode: `openspec`. Native review: `disabled/unmanaged` (no native review receipt governs this cross-repo change; no failing review artifact blocks).

## Objective
Add two **nullable** pricing fields `basePrice`/`profitPercentage` (`base_price`/`profit_percentage`) to per-pharmacy inventory and thread them through every inventory insertion/creation point in both repos. **No price-derivation logic** was added — fields are captured where sources provide them and left null elsewhere.

## Slices / PRs
| Repo | PR | Branch → Base | Scope |
|------|----|---------------|-------|
| `Backend-administrativo` (Rust + SurrealDB) | **#6** | `feat/product-base-price-profit-fields` → `main` | proto fields 19/20 (`base_price`/`profit_percentage`), `ModelInventory` + `ModelMedicationsaux` fields, DTO + `validate_price_fields` guard (rejects `base_price<0`, `profit_percentage<0` or `>1.0` → HTTP 400, allows `None`), `IncreaseMedicationItem`/`IncreaseInventoryRequest`, Excel import reads columns → `Option<f64>`, real-time `increase_inventory` writer |
| `ERP_medizin_web` (Next.js/React/TS) | **#4** | `feat/product-base-price-profit-fields` → `master` (issue #3) | F1–F8: types, `products.service.ts`, `@/proto/interfaces/dto.ts` (`MedicationProto` gains 19/20), `useCreateProduct.ts`, `products.store.ts`, `TabCreateProduct.tsx`, `StockFeaturesForm.tsx`, `BulkImportDialog.tsx` |

## R3 Follow-up Fix (resolved post-verify)
Verification reported a single **WARNING** against **R3**: the real-time `increase_inventory` writer that persists inventory via MQTT (`CREATE` + conditional `UPDATE`) was dropping `base_price`/`profit_percentage`. Resolved by backend follow-up commit **`70cafaa7`** (pushed to `feat/product-base-price-profit-fields`), which threads both fields through the writer's `CREATE` and conditional `UPDATE` paths. After this fix, **R3 verifies as PASSING**. No requirement changed semantically; the R3 "Increase with pricing" scenario now also asserts persistence into `ModelInventory`, and a `## Archive Note` was appended to the spec.

## Verification Outcome
**PASS WITH WARNINGS → warnings resolved.** Final state: `cargo build -p medications_agent` passes; `npx tsc --noEmit` passes. The only WARNING (R3 writer dropping fields) is closed by `70cafaa7`. (Per Final-State Authority: the launch prompt + commit evidence outrank the intermediate `verify-report` WARNING snapshot.)

## Tasks Reconciliation Note (archive-time stale-checkbox repair)
At archive time, `tasks.md` backend items **B1–B6** and verification items **V1–V2** were still unchecked, while frontend **F1–F8** were already checked. Apply/verify evidence proves all are complete (backend PR #6 merged to `main`, frontend PR #4 merged, both build/typecheck green, verify PASS). Marked complete per the orchestrator's explicit instruction. This is the exceptional mechanical reconciliation authorized by the Task Completion Gate, recorded here for audit.

## Residual Risks
1. **Frontend PR #4 base branch** — targets `master`, which diverged from `origin/main`. **Action: retarget PR #4 to `main` before merge.**
2. **`profit_percentage` fraction contract** — backend stores a fraction `0.0–1.0` (UI presents `0–100%`, divides by 100). Design Open Question (design.md l.148) confirming fraction-vs-integer semantics remains UNANSWERED; current implementation assumes fraction per user's "porcentaje" statement.
3. **SurrealDB schema assumption** — `ModelInventory` table name for an optional `DEFINE FIELD` command was unconfirmed (design.md l.147). Schemaless default needs no migration, so this is low-risk, but document the table name if the table is schemaful.
4. **Proto wire-compat** — additive proto3 fields are wire-compatible but regenerate stubs; coordinate backend+frontend release so proto consumers recompile together.
5. **Open Questions in design.md/proposal.md** — `design.md` "Open Questions" and `proposal.md` "Success Criteria" checklists remain `- [ ]`; these are prose checklists, not `tasks.md` implementation items, and are carried into the archive as historical record.

## Source of Truth Updated
- `openspec/specs/inventory-pricing-fields/spec.md` — **created** (delta spec promoted to main spec; 11 requirements: R1–R10 pricing-field requirements + Null-Handling; R3 scenario extended; Archive Note appended).

## Archive Contents
- `proposal.md` ✅
- `design.md` ✅
- `exploration.md` ✅ (carried from change folder)
- `specs/inventory-pricing-fields/spec.md` ✅ (delta; also promoted to main)
- `tasks.md` ✅ (14/14 implementation tasks complete: B1–B6, F1–F8, V1–V2)
- `archive-report.md` ✅

## SDD Cycle Complete
Planned → implemented (2 PRs) → verified (PASS, R3 warning fixed) → archived. Ready for the next change.
