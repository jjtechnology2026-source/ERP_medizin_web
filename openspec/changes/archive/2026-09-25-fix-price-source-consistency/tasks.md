# Tasks: Fix Price Source Consistency

**Repos** (relative paths below): FE = `/home/enzo/medizin/ERP_medizin_web`; BE = `/home/enzo/medizin/Backend-administrativo`. **Language**: English.
**Resolved decisions encoded**: D1 single VAT-inclusive `derive`; D2 discount participates in persisted `price`; D3/D6 proto `optional double vat = 15` (acked); D4 purchase invoice = per-lot acquisition cost; D5 delivery notes EXCLUDED (non-goal).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | BE ~1,050–1,300; FE ~300–380; total ~1,350–1,680 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 BE derive+writers → PR2 BE VAT transport → PR3 FE alignment/surface → PR4 backfill CLI+E2E |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |
| Decision needed before apply | No |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `shape::pricing` + invariant across writers | PR1 | `cargo test -p shape -p medications_agent -p phamacy_action -p http` | `#[ignore]` DB writer tests | revert PR1; no stored-data change until an edit |
| 2 | VAT transport/storage/listing (`optional vat=15`) | PR2 | `cargo test -p medications_agent -p phamacy_action` | increase → cursor listing | revert PR2; tag/wire type unchanged |
| 3 | FE alignment/surface | PR3 | `npm run test:pricing && npm run test:inventory && npm run test:store` | panel==register + `price_propagation_e2e` | revert PR3; FE-only |
| 4 | Backfill CLI + E2E | PR4 | `cargo test -p http -- price_backfill` | snapshot dry-run → apply → rollback | replay `price_backfill_log` |

### Slice Contracts

- **Slice 1 (PR1)** Start: `src/shape/src/pricing.rs` absent. Finish: every writer binds `DerivedPrice`. Verify: unit + no-bypass scan + `#[ignore]` writer tests. Rollback: revert commit; no write-path behavior change until a pricing edit occurs.
- **Slice 2 (PR2)** Start: PR1 merged. Finish: `vat` round-trips DTO→proto→inventory→listing at BOTH read sites (`:815`, `:1105`). Verify: transport/fallback tests. Rollback: revert; proto tag unchanged.
- **Slice 3 (PR3)** Start: slices 1–2 merged. Finish: panel renders stored price; FE sends `vat`. Verify: FE unit + `displayedChargePrice == fiscalUnitPriceBs`. Rollback: revert; BE invariant still holds.
- **Slice 4 (PR4)** Start: slices 1–3 merged. Finish: dry-run/apply/rollback proven on a snapshot. Verify: `price_backfill_e2e.rs`. Rollback: `--rollback --run-id`.

## Phase 1 — BE Derive + Invariant (Slice 1)

- [x] 1.1 Create `BE:src/shape/src/pricing.rs`: `DerivedPrice(f64)` (private field; only `derive` constructs it), `derive`, `effective_vat`, `DEFAULT_VAT_PCT=0.0` (fallback chain `inventory -> catalog -> 0`), `PriceInputError`; export from `BE:src/shape/src/lib.rs`.
- [x] 1.2 RED→GREEN unit tests: parity vectors `(0.8,40,0,0)→1.33`, `(0.8,40,16,0)→1.55`, `(10,30,16,0)→16.57`, `(0.8,40,0,10)→1.20`, `(10,30,16,10)→14.91`; fallback chain; `profit>=100`/non-finite and `discount` outside `[0,100)` rejected; absent inputs → `None`. [IPD-R2,R3,R8; IPF-R6]
- [x] 1.3 Replace `derived_selling_price` (`BE:.../medications_agent/src/infrastructure/repositories.rs:114-125`) with `shape::pricing::derive` (now VAT-inclusive).
- [x] 1.4 Bind `DerivedPrice` in every writer, resolving post-write `base_price/profit_percentage/vat/discount` + catalog `vat` via a bounded `WHERE product_id IN [...]` read: increase CREATE `:320-334`/bind `:631-668`; increase UPDATE `:295-315`/bind `:670-711` (drop `IF $pi>0` preserve; omit `price` when `derive→None`); no-lote propagation `:336-371`/`:719-752`; import CREATE `:1274-1291`; import UPDATE `:1318-1338`; `batch_add_medications` (`BE:.../phamacy_action/.../repositories.rs:735-744`, absent inputs → `skipped`); purchase invoice per-lot acquisition cost (`BE:.../purchase_invoices/.../purchase_invoices_impl.rs:125-134,:156-165`, replacing `precio_venta` in `create_invoice.rs:24-29`); catalog create (`BE:.../medications/.../repositories_products.rs:264-381`) MUST reject/de-route pricing loudly (no silent discard). [IPD-R1,R6; IPP-R2; ILT-R1]
- [x] 1.5 Widen gate: replace `should_propagate_price` (`:270-273`, applied `:624-628`) with `should_propagate_pricing(edits, lote, price)` fanning out on any derivation-input edit regardless of lot label, plus legacy no-lote `price>0`; a pure lot stock add does not fan out. [ILT-R2; IPP-R1]
- [x] 1.6 RED→GREEN source scan `#[test]` in `BE:src/http/src/` failing any `pharmacy_inventory` statement binding `price =` without a `DerivedPrice`. [IPD-R1 no-bypass]
- [x] 1.7 RED→GREEN `#[ignore]` DB tests in `medications_agent/src/test.rs`: per-writer derive; tri-state; fan-out down/up; lot-carrying decrease lowers aggregate; pure lot add unchanged; target row never stale; import explicit `vat=0` respected. [IPD-R1,R6,R8; IPP-R1; ILT-R2,R3] — done in slice 1 (15/15 local scratch DB); the pre-existing `DiconfigApp` remote-only `#[ignore]` tests in the same file were not run (production `.env`).
- [x] 1.8 Run `cargo test -p shape -p medications_agent -p phamacy_action -p http`. [IPD-R6]

**Commit boundary**: one work-unit commit for `shape::pricing` + writer enforcement.

## Phase 2 — BE VAT Transport (Slice 2)

> Ordering: depends on the acked proto decision (#6, `optional double vat = 15`). It IS acked; do not re-open.

- [x] 2.1 `BE:.../medications_agent/src/adapters/dto.proto:30`: `double vat = 15` → `optional double vat = 15` (existing tag; no new field/name).
- [x] 2.2 `BE:.../medications_agent/src/adapters/dto.rs`: `IncreaseMedicationItem.vat: Option<Option<f64>>` tri-state (mirror `:41-52`); `PriceFieldEdits.vat`; `validate_price_fields` (`:84-101`) validates `>=0` finite. [IPF-R2]
- [x] 2.3 `BE:.../shape/src/models/model_medications.rs:147,208`: `ModelInventory.vat` and `ModelMedicationsaux.vat` `i64`→`Option<f64>`. [IPF-R1]
- [x] 2.4 Live publisher `BE:.../medications_agent/src/infrastructure/controllers/increase_inventory.rs:140-147`: map `vat` into the proto + `price_edits`. [IPF-R3]
- [x] 2.5 Delete dead `BE:.../medications_agent/src/application/increase_inventory_orchestrator.rs` (absent from `application/mod.rs`) so a VAT-less `MedicationProto` builder cannot resurface.
- [x] 2.6 Listing: `RawInventoryRow` (`BE:.../phamacy_action/.../repositories.rs:370-380`) gains `vat`; grouped + fast SQL select it; `:815` AND `enrich_catalog_product` `:1088-1106` (vat at `:1105`) both use inventory-vat-or-catalog fallback; JSON `vat` output stays `i64`. [IPD-R3; IPF-R6]
- [x] 2.7 RED→GREEN tests: fallback chain incl. explicit `0`; proto with/without values; read-NULL distinct from `0`; round-trip DTO→proto→inventory→listing. [IPD-R3; IPF-R2,R3,R6]

**Commit boundary**: one work-unit commit for VAT transport.

## Phase 3 — FE Alignment / Surface (Slice 3)

- [x] 3.1 `FE:modules/products/lib/pricing.ts`: add `DEFAULT_VAT_PCT=0`, `derivePrice(base?,profit?,vat?,discount?)` = `round2(sellingPrice(base, profit??0, effectiveVat(vat)) * (1-(discount??0)/100))`, `parseVatInput` (`""`→undefined, `"0"`→0); make `bulkSellingPrice` a thin wrapper. [IPD-R2,R4]
- [x] 3.2 `FE:modules/products/components/TabCreateProduct.tsx:275,288`: replace `parseInt(vat) || 16` with `parseVatInput`. [IPD-R4; IPF-R5]
- [x] 3.3 `FE:modules/products/lib/inventory-write.ts:18-24,104-143`: add `vat` to `PricingSnapshot`/`buildIncreaseItem`; `pricingChanged` (`:71-78`) compares `vat`. [IPD-R4; IPF-R4]
- [x] 3.4 `FE:modules/products/components/StockFeaturesForm.tsx`: render persisted `currentMedicine.price` as `Precio Final (cobrado)` (USD + `toBs2(price*rate)`); label the derivation as preview-only; reload the listing after save; remove local `handleSubmit` price authority. [IPD-R5]
- [x] 3.5 `FE:modules/products/store/products.store.ts:327-336` remove silent no-op skip; `hook/useCreateProduct.ts:94-121`; `api/products.service.ts:106-133` stop sending catalog `basePrice/profitPercentage`; `components/BulkImportDialog.tsx`; add `vat?` to `types/products.types.ts`. [IPD-R6; IPF-R4,R5]
- [x] 3.6 RED→GREEN tests: `test/pricing.test.mjs:44` two-line contract `bulkSellingPrice(10,30)===14.29` (absent VAT defaults to 0%) and `bulkSellingPrice(10,30,0)===14.29`; parity vectors; `test/inventory-write.test.mjs` `vat` in `shouldWriteInventory`; `test/products-store.test.mjs` no silent skip; extract pure `displayedChargePrice(med)` asserting it and `fiscalUnitPriceBs(med.price,rate)` both read `med.price`. [IPD-R4,R5; IPF-R5]

**Commit boundary**: one work-unit commit for FE alignment/surface.

## Phase 4 — Backfill CLI + E2E (Slice 4)

- [x] 4.1 Create `BE:src/http/src/bin/price_backfill.rs` + `[[bin]]` in `BE:src/http/Cargo.toml`: sidecar `price_backfill_log{id,run_id,row_id,prev_price,new_price,base_price,profit,vat,discount,created_at}`; `--dry-run` default, `--apply`, `--rollback`, `--run-id`; dry-run reports `{total,divergent,skipped_null,consistent}` + diff and writes nothing; apply `UPDATE price` + `INSERT log` in one transaction; rollback replays the log by `run_id`; idempotent. [IPD-R7]
- [x] 4.2 RED→GREEN `BE:src/http/src/price_backfill_e2e.rs` (`#[ignore]`) on a snapshot: dry-run reports, apply reconciles, rollback restores exact prior values, NULL inputs skipped. [IPD-R7]
- [x] 4.3 Extend `BE:src/http/src/price_propagation_e2e.rs`: increase with VAT → cursor listing returns `price==derive(...)` and `vat`, and that value is what `fiscalLineTotalBs` consumes (runtime panel==register E2E). [IPD-R5; IPP-R1,R3]
- [ ] 4.4 Execute snapshot rehearsal → dry-run → apply; record `divergent_before`, `reconciled_after`, `unexplained=0`, rollback proof; production read-only `GET /admin/Pharmacy/{id}/medications/cursor?query=<barcode>` before/after. [IPD-R7] — deferred (operator-run on production, snapshot-gated): local scratch rehearsal, dry-run, apply and rollback are done; the production `--apply` and read-only before/after were not executed.
- [ ] 4.5 Verify reporting consumers (`low_stock`, `resumen`/`valor_venta` `:981`, movement snapshot `:173`, PDF) unchanged. [IPP-R3] — partial: `resumen`/`valor_venta`/`low_stock` verified by E2E; the movement-snapshot/PDF runtime test was not added (verify-report W-4).

**Commit boundary**: one work-unit commit for backfill CLI + E2E.

## Phase 5 — Non-Goals, Docs, Cleanup

- [x] 5.1 Document **delivery notes are EXCLUDED from the invariant** as an explicit non-goal; `BE:.../delivery_note/src/infrastructure/repositories.rs:518-529` MUST NOT derive the inventory price and MUST NOT be part of invariant tests. [ILT-R1-S1.2 → N/A non-goal] — done: exclusion documented in design D5; both delta specs narrowed to purchase invoices (S1.2 re-stated as a negative scenario).
- [x] 5.2 Report (do not fix) the Excel import explicit-`vat=0` row price change; excluded from backfill. [IPP-R2]
- [ ] 5.3 Resolve verification inputs against real `BOTELLON DE AGUA RECARGA` rows (price, base_price, profit_percentage, lote, vat) and the `11`/`7Frasco` screenshot meaning. — not executed: production data access is forbidden (verify-report W-5 / Interim Deployment Risk); the screenshot meaning remains unresolved.
- [x] 5.4 Confirm the register does not re-apply `discount` (`fiscal-totals.ts:42` charges stored `price`). [D2]

## Verification Map (requirement/scenario → proof)

| Capability | Requirement | Scenarios | Proof task(s) |
|---|---|---|---|
| inventory-price-derivation | R1 Derived Price Invariant | S1.1–S1.5 | 1.4, 1.6, 1.7, 4.3 |
| | R2 One Authoritative Formula | S2.1–S2.3 | 1.1, 1.2, 3.1, 3.6 |
| | R3 VAT Authoritative Per Pharmacy | S3.1–S3.4 | 2.6, 2.7 |
| | R4 Explicit Zero VAT Preserved | S4.1–S4.3 | 3.1, 3.2, 3.3, 3.6 |
| | R5 Panel Display == Register Price | S5.1–S5.2 | 3.4, 3.6, 4.3 |
| | R6 Every Price Writer Covered | S6.1–S6.2 | 1.4, 1.6, 1.7, 3.5 |
| | R7 Backfill Reconciles | S7.1–S7.4 | 4.1, 4.2, 4.4 |
| | R8 Tri-State Inputs Preserved | S8.1–S8.2 | 1.2, 1.7, 2.2 |
| inventory-price-persistence | R1 Persisted Price Observable | S1.1–S1.5 | 1.5, 1.7, 4.3, 4.5 |
| | R2 Price Floor/Semantics Unchanged | S2.1–S2.2 | 1.4, 1.7, 5.2 |
| | R3 Read-Only Consumers Consistent | S3.1–S3.3 | 4.5 |
| inventory-pricing-fields | R1 Model Nullable Pricing Fields | S1.1–S1.2 | 2.3, 2.7 |
| | R2 Increase DTO Carries Pricing | S2.1–S2.3 | 2.2, 2.7 |
| | R3 MedicationProto Carries Pricing | S3.1–S3.2 | 2.1, 2.4, 2.7 |
| | R4 FE Types Carry Optional Pricing | S4.1–S4.2 | 3.3, 3.5, 3.6 |
| | R5 TabCreateProduct Exposes Inputs | S5.1–S5.3 | 3.2, 3.5, 3.6 |
| | R6 Null Handling Safe Everywhere | S6.1–S6.3 | 1.2, 2.2, 2.6, 2.7 |
| inventory-lot-tracking | R1 Per-Lot Acquisition Price | S1.1, S1.3 (S1.2 N/A non-goal) | 1.4, 1.7, 5.1 |
| | R2 Lot-Carrying Writes Consistent | S2.1–S2.3 | 1.5, 1.7, 4.3 |
| | R3 Lot Scope Unchanged | S3.1–S3.2 | 1.5, 1.7 |

Threat Matrix: N/A (no routing, shell, subprocess, VCS/PR, executable-classification, or process-integration boundary).
