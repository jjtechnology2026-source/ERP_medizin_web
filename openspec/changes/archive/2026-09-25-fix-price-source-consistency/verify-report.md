```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:209499cbab25b6e0f31dca5c195aa98f9265227a9bfa3518bea3878df8cae73f
verdict: pass
blockers: 0
critical_findings: 0
requirements: 20/20
scenarios: 46/58
test_command: "BE: cargo test -p shape -p medications_agent -p phamacy_action; cargo test --manifest-path src/http/Cargo.toml --lib; cargo test -p purchase_invoices; local-SurrealDB #[ignore] scratch + E2E (serial). FE: npm run test:pricing|test:inventory|test:store|test:fiscal|test:fiscal-fallback"
test_exit_code: 0
test_output_hash: sha256:489ee91ecf6e5d89fd824e55877d20ffc41e347dd5cbc2b91f592e674d629a43
build_command: "BE: cargo check --workspace. FE: npx tsc --noEmit; npm run build"
build_exit_code: 0
build_output_hash: sha256:1609c13510b2ef322156a70d35c02376a88331bb9fe94e3402e2d56b2732932e
```

# Verification Report

**Change**: `fix-price-source-consistency`
**Version**: N/A (delta specs, 4 capabilities)
**Mode**: Standard (Strict TDD inactive; RED-first tests were written where named)
**Repos**: FE `ERP_medizin_web` @ `3baf69a` (`feat/price-derivation-fe`); BE `Backend-administrativo` @ `5be7fb44` (`feat/price-vat-transport-be`, stacked on `feat/price-derivation-be-core` @ `24e50241`)
**Verifier note**: `gentle-ai sdd-verify-validate` is **not invocable** in this environment (`gentle-ai sdd-verify-validate` → `unknown command`; only its description string exists in the binary). The validator gate was therefore skipped as unavailable; the report bytes below are the ones persisted to OpenSpec and Engram. No source code was modified during verification.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total (tasks.md checkboxes) | 30 |
| Tasks complete (tasks.md) | 6 |
| Tasks incomplete (tasks.md) | 24 |
| Slices actually delivered (apply-progress) | 4 / 4 |
| Slices independently verified here | 4 / 4 |

The `tasks.md` artifact is **stale**: only Phase 3 (FE, 3.1–3.6) is checked. Phases 1, 2, 4 and the Phase 5 cleanup remain `[ ]`. The Engram `apply-progress` artifact (revision 9) marks **every** slice item `[x]` (1.1–1.8, 2.1–2.7, 3.1–3.6, 4.1–4.5) and each deliverable was independently confirmed present and green in this run. `gentle-ai sdd-status fix-price-source-consistency` reports `tasks: 6/30 complete` yet `verify: ready`. This is a bookkeeping gap, not unbuilt work — see **WARNING W-1**.

## Build & Tests Execution

**Build**: ✅ Passed
```text
BE  cargo check --workspace                         -> Finished `dev` profile, EXIT=0
FE  npx tsc --noEmit                                 -> EXIT=0
FE  npm run build (Next.js 16.1.5 Turbopack)         -> ✓ Compiled successfully in 5.9s
                                                        ✓ Generating static pages (17/17)
                                                        EXIT=0
```

**Tests**: ✅ all green (0 failed) — real re-run summaries
```text
BE non-ignored (feat/price-vat-transport-be @ 5be7fb44)
  cargo test -p medications_agent  -> ok. 58 passed; 0 failed; 29 ignored
  cargo test -p phamacy_action     -> ok. 45 passed; 0 failed; 14 ignored
  cargo test -p shape              -> ok. 30 passed; 0 failed;  0 ignored
  cargo test --manifest-path src/http/Cargo.toml --lib -> ok. 33 passed; 0 failed; 3 ignored
  cargo test -p purchase_invoices  -> ok. 22 passed; 0 failed; 19 ignored

BE DB #[ignore] against LOCAL SurrealDB (ws://127.0.0.1:8000), serial, DISTINCT scratch ns/db
  medications_agent scratch, one invocation each (verify_q4b_ns / verify_prc_ns):
    15 / 15 passed (0 failed): price_tristate_agrees_between_edited_row_and_siblings;
    price_tristate_applies_to_created_sin_lote_row;
    no_lote_price_propagation_updates_all_lot_rows_and_preserves_labels;
    no_lote_price_only_edit_preserves_other_lot_rows_pricing;
    no_lote_edit_with_all_fields_normalizes_every_lot_row;
    no_lote_price_decrease_then_increase_moves_single_row;
    positive_stock_delta_stays_additive_with_propagation;
    increase_create_and_update_persist_derived_price;
    lot_carrying_pricing_write_lowers_aggregate_price;
    pure_lot_stock_add_does_not_change_price;
    invalid_profit_is_rejected_and_persists_no_price;
    import_stock_derives_and_persists_inputs;
    absent_base_preserves_stored_price;
    increase_writes_inventory_vat_and_derives_with_it;
    increase_new_product_vat_tristate_falls_back_and_keeps_explicit_values
  http E2E #[ignore] --test-threads=1 (verify_e2e_ns / verify_backfill_ns):
    3 passed; 0 failed  (2 propagation + 1 backfill)
      price_backfill_e2e::backfill_dry_run_apply_rollback_round_trip
        DRY-RUN SUMMARY:  scanned: 5, consistent: 2, divergent: 2, skipped_null: 1,
                          explicit_vat_zero: 1, changed: 0, restored: 0, run_id: None
        APPLY SUMMARY:    scanned: 5, consistent: 2, divergent: 2, skipped_null: 1,
                          explicit_vat_zero: 1, changed: 2, restored: 0,
                          run_id: Some("01M3CQKDFA8B3HM2X8RYPCDN5F")
        ROLLBACK SUMMARY: scanned: 2, ..., changed: 0, restored: 2, run_id same
      price_propagation_e2e::increase_with_vat_is_visible_in_cursor_listing
        A (explicit vat 0) -> price 10.0, vat 0  (NOT 16)
        B (explicit vat 8) -> price 10.8, vat 8
        C (absent -> catalog 16) -> price 11.6, vat 16
        resumen: {"total_articulos":3,"valor_venta":32.4,"valor_costo":30.0,"articulos_bajo_stock":0}
      price_propagation_e2e::no_lote_price_decrease_is_visible_in_cursor_listing
        baseline 1450.0 -> after 1.55; 3 raw rows all 1.55; lot labels unchanged

  CLI price_backfill (target/debug/price_backfill) against LOCAL scratch cli_verify_ns:
    --dry-run  scanned=4 consistent=1 divergent=2 skipped_null=1 explicit_vat_zero=1 changed=0
               pharmacy_inventory:cli_v_r1 9.99 -> 1.55 @ 16%
               pharmacy_inventory:cli_v_r2 11.6 -> 10  @ 0%
               REPORT ONLY — 1 row(s) carry an explicit vat=0 (legacy import); not silently changed: cli_v_r2
    --apply    changed=2 run_id=01M3CQNXGKQYM82241ZV4690NA
    raw after  r1 price 1.55 vat 16.0 ; r2 price 10.0 vat 0.0 ; r3 123.0 vat null ; r4 16.57 vat null
    --rollback restored=2
    raw after  r1 price 9.99 vat null ; r2 price 11.6 vat 0.0 ; r3 123.0 ; r4 16.57  (EXACT prior values)
    guard rails: `--dry-run --apply` -> ERROR exit 2 ; remote URL -> refused, exit 2

FE (npm)
  test:pricing          -> tests 18, pass 18, fail 0
  test:inventory        -> tests 27, pass 27, fail 0
  test:store            -> tests  8, pass  8, fail 0
  test:fiscal           -> tests 42, pass 42, fail 0
  test:fiscal-fallback  -> tests 25, pass 25, fail 0
```

**Coverage**: ➖ Not available (no coverage tooling configured in either repo). Scenario-level coverage below is behavioral, not line coverage.

**Local-SurrealDB isolation**: started with `docker compose up -d surrealdb` (port 8000 was free; no other SurrealDB running), overrode **every** DSN to `ws://127.0.0.1:8000 root/root` and used distinct scratch namespaces (`verify_q4b_ns`, `verify_prc_ns`, `verify_e2e_ns`, `verify_backfill_ns`, `cli_verify_ns`), dropped each namespace afterwards and ran `docker compose down`. The repo `.env` points at production and was never used by any executed test.

## Spec Compliance Matrix

Statuses: ✅ COMPLIANT (covering test ran and passed) · ⚠️ PARTIAL (test passes but covers only part) · ❌ NOT VERIFIED (no runtime coverage here) · N/A (documented non-goal).

### Capability `inventory-price-derivation` (ADDED) — 8 requirements, 25 scenarios

| # | Requirement | Scenario | Evidence (test) | Result |
|---|---|---|---|---|
| 1 | R1 Derived Price Invariant | Single-lot increase and decrease | `test::tests::increase_create_and_update_persist_derived_price`, `…no_lote_price_decrease_then_increase_moves_single_row` | ✅ |
| 2 | R1 | Multi-lot increase and decrease | `…no_lote_price_propagation_updates_all_lot_rows_and_preserves_labels` | ✅ |
| 3 | R1 | USD and Bs agree | `test/pricing.test.mjs` `displayedChargePrice … === fiscalUnitPriceBs(med.price,rate)`; E2E listing price; `money.ts` | ✅ |
| 4 | R1 | Absent inputs preserve (not invent) | `…absent_base_preserves_stored_price` | ✅ |
| 5 | R1 | Invalid profit rejected | `…invalid_profit_is_rejected_and_persists_no_price`; `shape::pricing` `invalid_profit_is_rejected_never_defaulted` | ✅ |
| 6 | R2 One Authoritative Formula | Frontend/backend parity | `shape::pricing::tests::parity_vectors_match_frontend`; `pricing.test.mjs` `derivePrice: vectores de paridad` | ✅ |
| 7 | R2 | Backend now includes VAT | parity vector `(0.8,40,16,0)→1.55` (shape); E2E B | ✅ |
| 8 | R2 | Absent profit defaults to zero | `shape::pricing` `absent_profit_defaults_to_zero` | ✅ |
| 9 | R3 VAT Authoritative Per Pharmacy | Edit VAT on one pharmacy (A changes, B unchanged) | E2E per-row VAT persistence + `…increase_writes_inventory_vat_and_derives_with_it`; **no explicit two-pharmacy A/B isolation test** | ⚠️ |
| 10 | R3 | Explicit zero stays zero | E2E row A `vat 0` (`NOT 16`); `shape::pricing::explicit_zero_vat_is_preserved` | ✅ |
| 11 | R3 | Absent inventory VAT falls back | E2E row C (catalog 16 → 11.6/16); listing `effective_vat(row.vat, Some(product.vat))` | ✅ |
| 12 | R3 | No VAT source | `shape::pricing::effective_vat_fallback_chain` (`None,None → 0`) | ✅ |
| 13 | R4 Explicit Zero VAT End-To-End | Create with 0% VAT | `parseVatInput("0")→0`; source-pin `TabCreateProduct` starts at `String(DEFAULT_VAT_PCT)`; **no runtime component/DB create-0 test** | ⚠️ |
| 14 | R4 | Bulk import with 0% VAT | `test/inventory-write.test.mjs` `buildIncreaseItem forwards an explicit 0 VAT`; `bulkSellingPrice(10,30,0)===14.29` | ✅ |
| 15 | R4 | Absent VAT still defaults | `effectiveVat` tests; `bulkSellingPrice(10,30)===14.29` | ✅ |
| 16 | R5 Panel == Register | Panel equals register after edit | `displayedChargePrice … === med.price` pure test + E2E cursor listing; **no browser-level check executed** | ⚠️ |
| 17 | R5 | Mismatch impossible by construction | `displayedChargePrice(med)` reads `med.price`; `fiscalLineTotalBs(med.price,…)` | ✅ |
| 18 | R6 Every Price Writer | Each writer derives | increase CREATE/UPDATE/fan-out/import (scratch DB); purchase invoice unit `inventory_sale_price_derives_cost_margin_and_vat`; **`batch_add_medications` has no DB test** | ⚠️ |
| 19 | R6 | Catalog create no silent discard | Code rejects loudly (`repositories_products.rs:272-286`); **no covering test** | ❌ |
| 20 | R7 Backfill | Dry run | `price_backfill_e2e` + CLI dry-run | ✅ |
| 21 | R7 | Apply reconciles | `price_backfill_e2e` apply; CLI apply | ✅ |
| 22 | R7 | Rollback | `price_backfill_e2e` rollback; CLI rollback exact | ✅ |
| 23 | R7 | NULL inputs skipped | E2E `skipped_null: 1`; row C untouched | ✅ |
| 24 | R8 Tri-State | Value vs clear vs absent | `…price_tristate_agrees_between_edited_row_and_siblings`; `price_propagation_sql_clear_sets_none_and_absent_stays_unnamed` | ✅ |
| 25 | R8 | Zero is a value | `…increase_new_product_vat_tristate_falls_back_and_keeps_explicit_values`; `new_product_row_omits_absent_vat_and_keeps_explicit_values` | ✅ |

### Capability `inventory-price-persistence` (MODIFIED) — 3 requirements, 10 scenarios

| # | Requirement | Scenario | Evidence (test) | Result |
|---|---|---|---|---|
| 26 | R1 Persisted Observable | Single-row decrease then increase | `…no_lote_price_decrease_then_increase_moves_single_row` | ✅ |
| 27 | R1 | Multi-lot decrease | `…lot_carrying_pricing_write_lowers_aggregate_price` | ✅ |
| 28 | R1 | Derived price after reload | E2E `listing_price == derive(...)` | ✅ |
| 29 | R1 | Lot-carrying decrease is visible | `…lot_carrying_pricing_write_lowers_aggregate_price`; E2E 3 rows all lowered | ✅ |
| 30 | R1 | Reporting consumers | E2E `resumen.valor_venta`, `total_articulos`, `low_stock`; **PDF report has no runtime test** | ⚠️ |
| 31 | R2 Price Floor Unchanged | Zero or absent price | Only test is `increase_with_zero_price_keeps_stored_price` (DiconfigApp, remote `.env`) → **not run**; preserve semantics partially covered by `absent_base_preserves_stored_price` | ⚠️ |
| 32 | R2 | Derivation now includes VAT | `shape::pricing` parity; E2E | ✅ |
| 33 | R3 Read-Only Consumers | valor_venta regression | E2E `valor_venta == sum(stock*price)` | ✅ |
| 34 | R3 | Movement snapshot | **No dedicated runtime test** (consumer reasoned about only) | ❌ |
| 35 | R3 | Listing aggregation unchanged | E2E raw rows; `math::max(price)` untouched | ✅ |

### Capability `inventory-pricing-fields` (MODIFIED) — 6 requirements, 15 scenarios

| # | Requirement | Scenario | Evidence (test) | Result |
|---|---|---|---|---|
| 36 | R1 Model Nullable | New inventory row with all values | E2E raw rows; `…price_tristate_applies_to_created_sin_lote_row` | ✅ |
| 37 | R1 | Missing values store NULL | E2E row C `vat Null`; `new_product_row_omits_absent_vat…` | ✅ |
| 38 | R2 Increase DTO Carries Pricing | Increase with VAT | E2E A/B/C; `…increase_writes_inventory_vat_and_derives_with_it` | ✅ |
| 39 | R2 | Explicit zero VAT | E2E row A stored `0.0`; `increase_new_product_vat_tristate…` | ✅ |
| 40 | R2 | Increase without pricing | `proto_round_trip_preserves_vat_presence` (unset stays absent) | ✅ |
| 41 | R3 MedicationProto Carries Pricing | Proto with values | `proto_round_trip_preserves_vat_presence`; `dto.proto:30 optional double vat = 15` | ✅ |
| 42 | R3 | Proto without values | same test (`decoded.vat == None`) | ✅ |
| 43 | R4 FE Types | Type carries values | `buildIncreaseItem forwards pricing fields` | ✅ |
| 44 | R4 | Type without values | `buildIncreaseItem … conditional optionals` | ✅ |
| 45 | R5 TabCreateProduct | User enters values incl. zero VAT | Source-pin test + `parseVatInput("0")→0`; **component not executed (JSX)** | ⚠️ |
| 46 | R5 | Price-only create with zero stock | `shouldWriteInventory`/`buildIncreaseItem` units; **no create→increase integration runtime** | ⚠️ |
| 47 | R5 | User leaves blank | `parseVatInput("")→undefined`; `effectiveVat(undefined)→0` | ✅ |
| 48 | R6 Null Handling | Insert without value | E2E row C NULL; DB create tests | ✅ |
| 49 | R6 | Read null | E2E raw rows `vat Null`; listing fallback | ✅ |
| 50 | R6 | NULL differs from zero | E2E rows C (null→catalog 16) vs A (0→10.0); `effective_vat_fallback_chain` | ✅ |

### Capability `inventory-lot-tracking` (ADDED) — 3 requirements, 8 scenarios

| # | Requirement | Scenario | Evidence (test) | Result |
|---|---|---|---|---|
| 51 | R1 Per-Lot Acquisition Price | Invoice lot row derives | `purchase_invoices` `inventory_sale_price_derives_cost_margin_and_vat` (non-ignored, passed); `purchase_invoices_impl.rs` per-lot derive | ✅ |
| 52 | R1 | Delivery note lot row derives | Delivery notes are an **explicit non-goal** (design D5; tasks 5.1); repo allow-listed in the scan. **The spec text was never narrowed to purchase invoices** | ❌ (spec) / N/A (design) |
| 53 | R1 | Aggregate inputs stay coherent | `math::max(base_price/price)` consumers unchanged; **no dedicated test** | ⚠️ |
| 54 | R2 Lot-Carrying Writes | Lot write decreases the aggregated price | `…lot_carrying_pricing_write_lowers_aggregate_price` | ✅ |
| 55 | R2 | No-lote write still propagates | `…no_lote_price_propagation_updates_all_lot_rows_and_preserves_labels` | ✅ |
| 56 | R2 | Read semantics unchanged | E2E labels; raw rows; `math::max(price)` untouched | ✅ |
| 57 | R3 Lot Scope Unchanged | Pricing write adds no lot row | E2E lots `[None, L-2026-01, L-2026-02]` unchanged | ✅ |
| 58 | R3 | Row-scoped stock preserved | `…positive_stock_delta_stays_additive_with_propagation` | ✅ |

**Compliance summary**: 46/58 scenarios COMPLIANT · 10/58 PARTIAL · 2/58 NOT VERIFIED (no runtime test) · 1 design-excluded non-goal (spec unreconciled). All 20 requirements have implementation evidence and at least one passing runtime test.

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Single derivation (`shape::pricing::derive`) | ✅ Implemented | `DerivedPrice(f64)` private field; `derive`/`effective_vat`/`DEFAULT_VAT_PCT=0.0`; formula `round2((base/(1-profit/100))*(1+vat/100)*(1-discount/100))` |
| VAT fallback `inventory → catalog → 0` | ✅ Implemented | `effective_vat`; explicit `0` is `Some(0.0)` and never falls through; BE `DEFAULT_VAT_PCT = 0.0` (not 16) |
| Discount in persisted price, not re-applied at register | ✅ Implemented | `derive` applies discount; `fiscal-totals.ts:42` charges stored `med.price` only |
| Every writer binds `DerivedPrice` | ✅ Implemented | increase CREATE/UPDATE/fan-out, import CREATE/UPDATE, `batch_add`, purchase-invoice per-lot; `should_propagate_pricing(edits,lote,price)` widened (old `should_propagate_price` absent) |
| Catalog create rejects pricing loudly | ✅ Implemented | `repositories_products.rs:272-286` returns `ConstraintViolation`; raw `price` is warned, not silently dropped |
| Proto VAT presence | ✅ Implemented | `dto.proto:30 optional double vat = 15` (tag unchanged) |
| Backfill reversible + dry-run default | ✅ Implemented | `price_backfill_log`; `--dry-run` default; `--apply`; `--rollback --run-id`; guard rails require all five env vars and refuse non-localhost |
| Read semantics frozen | ✅ Implemented | `math::max(price)`, `resumen.valor_venta`, `low_stock`, `pharmacy_search` untouched |

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D1 single `derive` in `shape`, VAT-inclusive, round2 once | ✅ Yes | Parity vectors identical BE/FE |
| D2 discount participates in persisted price | ✅ Yes | Register charges stored price; no re-application |
| D3 VAT per-pharmacy, fallback inventory→catalog→**0** | ✅ Yes | `optional double vat = 15`; listing uses inventory-vat-or-catalog; default 0 |
| D3 dead orchestrator deleted | ✅ Yes | `increase_inventory_orchestrator.rs` removed (258 deletions) |
| D4 one choke point + widened gate | ✅ Yes | `DerivedPrice` compile guarantee; `should_propagate_pricing` fans out on any input edit regardless of lot |
| D4 no-bypass scan | ⚠️ Partial | File-level/pattern-based (`price_derivation_scan.rs`): a file passes if it contains `pharmacy_inventory` **and** any `price = $|price = NONE|price = IF` **and** `shape::pricing` anywhere. Weaker than per-statement proof — see W-3 |
| D4 purchase invoice = per-lot acquisition cost | ✅ Yes | `precio_unitario → base_price`, `derive` replaces `precio_venta` |
| D4 delivery notes EXCLUDED | ✅ Yes (design) | `delivery_note/.../repositories.rs:518` keeps the legacy `IF … ELSE price`; allow-listed; **spec not narrowed** — see W-2 |
| D5 per-lot decision (delivery note blocking question) | ✅ Resolved as exclusion | Product-level-intent option; documented non-goal |
| D6 FE alignment/surface | ✅ Yes | `derivePrice`, `DEFAULT_VAT_PCT=0`, `parseVatInput`, `displayedChargePrice`; panel renders persisted price |
| D7 backfill sidecar + dry-run/apply/rollback | ✅ Yes | Apply also writes effective VAT for divergent rows (extension over D7, logged prior VAT for exact rollback) |
| D8 rollout order BE→backfill→FE | ⚠️ Not yet executed | See **Interim Deployment Risk** — merge order still matters |

## Requirements Coverage Gaps / Deviations (reported, not hidden)

- **Anti-bypass scan is file-level/pattern-based** (W-3), corroborating but not replacing the compile-time `DerivedPrice` guarantee.
- **`DiconfigApp` remote-only `#[ignore]` tests were not run**: 14 in `medications_agent/src/test.rs` (incl. `increase_with_zero_price_keeps_stored_price`) and all 19 in `purchase_invoices/src/test.rs`, plus 14 in `phamacy_action/src/test.rs`. They resolve `APP__SURREALDB__*` from the repo `.env` (production) and were deliberately excluded.
- **Movement-snapshot / PDF consumers** were reasoned about as read-only consumers of the same stored `price`; no dedicated runtime test (covers IPP-R3-S3.2 / IPD-R7).
- **`batch_add_medications` writes no per-pharmacy VAT**: its row JSON at `phamacy_action/.../repositories.rs:783-795` has no `vat`; it derives with catalog VAT only. Falls back correctly but does not persist the per-pharmacy authority.
- **`products.service.ts` still sends `price` to `/Medications/Create`** (`createProduct` payload `price: Number(medication.price) || 0`). The backend warns and discards it; it does not reject. Deviation #4 confirmed.
- **Purchase-invoice derive uses catalog VAT only** (`purchase_invoices_impl.rs:85`), not an existing per-pharmacy inventory VAT for the same product.
- **Panel==register was not browser-verified**: only the pure equivalence test and the DB cursor-listing E2E.

## Issues Found

**CRITICAL**: None that leave a required mutation behavior unproven — every price-write path has a passing runtime test.

**WARNING**
- **W-1 — `tasks.md` not reconciled**: 24/30 checkboxes unchecked (Phases 1, 2, 4, 5) while apply-progress and this verification confirm all four slices delivered. Per a literal reading of `sdd-verify`, unchecked tasks are CRITICAL; treated here as artifact hygiene because every deliverable was independently verified. Reconcile before archive.
- **W-2 — `inventory-lot-tracking` R1 spec vs design D5**: the spec requires delivery-note per-lot derivation (scenario S1.2); design D5 explicitly excludes delivery notes and tasks 5.1 maps S1.2 to N/A. The delta spec was never narrowed, so the spec as written is not satisfied. Either narrow the spec to purchase invoices or re-open the decision before archive.
- **W-3 — Anti-bypass scan is file-level**: `price_derivation_scan.rs` can be fooled by a file that mentions `shape::pricing` elsewhere while a different statement binds a raw `price`. Compile-time newtype is the real guarantee; the scan is belt-and-suspenders only.
- **W-4 — Coverage gaps** (IPP-R3-S3.2 movement snapshot; IPD-R6-S6.2 catalog-create rejection; ILT-R1-S1.3 aggregate coherence): no covering runtime test.
- **W-5 — Remote-only `DiconfigApp` tests not run** (zero-price preserve among them): the environment forbids production access, so those paths are NOT VERIFIED here.
- **W-6 — `batch_add_medications` persists no per-pharmacy VAT** and derives with catalog VAT only; purchase-invoice derive likewise ignores existing inventory VAT.
- **W-7 — Interim deployment risk**: Slice 1 (BE) rejects `base_price`/`profit_percentage` on `/Medications/Create`. The pre-change FE does send them (`origin/master products.service.ts:126-127`). If BE ships before FE Slice 3, **priced product creation and bulk import break**.

**SUGGESTION**
- S-1: Excel template samples still show `"IVA": 16` (`TabCreateProduct.tsx:159`, `BulkImportDialog.tsx:71`) while the documented default is now 0%; consider aligning the sample or annotating it.
- S-2: Add dedicated tests for the catalog-create rejection (`repositories_products.rs`) and a movement-snapshot/PDF consumer assertion to close the coverage gaps.
- S-3: Consider reading the pharmacy's existing inventory VAT (not only catalog) when writing purchase-invoice lot rows.

## Interim Deployment Risk & Required Merge/Deploy Order

The FE and BE contracts are **not independently deployable**. Required order:

1. **Deploy `/Medications/Create` rejection only after the FE that stops sending `base_price`/`profit_percentage`** — i.e. merge/deploy the BE core (Slice 1) and the FE Slice 3 **together**, or FE Slice 3 first. If BE Slice 1 reaches an environment still running the old FE (`origin/master`), `POST /Medications/Create` returns `ConstraintViolation` and product creation + bulk import fail.
2. **BE derivation + VAT transport (Slices 1–2)** can ship before the backfill: the increase DTO is additive and no stored data changes until a pricing edit.
3. **Backfill (Slice 4)** runs as a separate, rehearsed, dry-run-first operation after Slices 1–2 are live: snapshot → `--dry-run` (record `divergent_before`) → `--apply` (record run_id, confirm `unexplained = 0`) → optional `--rollback --run-id`. Note `--apply` materializes the effective VAT on divergent rows with NULL inventory VAT.
4. **FE Slice 3** may deploy with or before Slices 1–2 (it only stops sending catalog pricing and surfaces the stored price); it must deploy no later than Slice 1.
5. The register's `discount` re-application must remain absent (it already charges stored `price`).

Rollback: revert the BE commits; replay `price_backfill_log` by `run_id`; read semantics were never changed, so old code reads restored values.

## Verdict

**PASS WITH WARNINGS**

All four slices are implemented and every runnable build/test suite is green (BE non-ignored 188 passed / 0 failed across shape+medications_agent+phamacy_action+http; 15/15 scratch DB tests; 3/3 DB E2E; FE 120 passed / 0 failed; `cargo check` and FE build exit 0). 46/58 scenarios are runtime-compliant; the remainder are partial or lack a dedicated test, and the `inventory-lot-tracking` delivery-note scenario conflicts with the approved design and must be reconciled. No functional defect was found, but W-1, W-2 and W-4 should be resolved before archive.
