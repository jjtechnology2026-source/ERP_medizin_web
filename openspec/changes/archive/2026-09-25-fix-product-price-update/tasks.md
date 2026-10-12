# Tasks: Fix Product Price Update

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | FE ~300-340, BE ~150-180; total ~450-520 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 FE helpers+tests → PR 2 FE wiring → PR 3 BE propagation |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (independent cross-repo slices: FE→`master`, BE→`dev`) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Pure FE helpers + unit tests | PR 1 (base `master`) | `npm run test:inventory` | N/A — pure Node helpers, no React | Delete `modules/products/lib/inventory-write.ts`, `test/inventory-write.test.mjs`, `test:inventory` script |
| 2 | FE wiring A/B/D + error surfacing | PR 2 (base `master`) | `npm run test:inventory && npm run build` | Manual: edit price stock 0, refresh; bulk import price-only row | Revert the 4 FE files; helpers/tests remain green |
| 3 | BE propagation C + Rust tests + doc | PR 3 (base `dev`) | `cargo test -p medications_agent -p phamacy_action` | `cargo test -p medications_agent -- --ignored` (SurrealDB); `GET /admin/Pharmacy/{id}/medications/cursor?query=<barCode>` | Revert `medications_agent/.../repositories.rs` + `test.rs` + `docs/api/MedicationsAgent.md` |

**Backend edit authority**: `allowedEditRoots` is frontend-only today; the user grants the BE root at apply (base branch `dev`).
**W3 reconciliation**: `inventory-price-persistence/spec.md:6` "for every existing product" is bounded by `inventory-lot-tracking/spec.md:24-27`. A lot-only or pure no-op save legitimately skips the write; "every existing product" means every existing product whose save actually changes a price field (or stock delta).
**W1**: `minimum` PARTICIPATES in the EXISTING-product change comparison (a minimum-only edit still persists); `minimum` is NOT propagated cross-lot.

## Phase 1: Foundation — pure inventory-write helpers (RED→GREEN)

- [x] 1.1 Create `modules/products/lib/inventory-write.ts` exporting pure `shouldWriteInventory`, `buildIncreaseItem`, `mergeEcho` (no React).
- [x] 1.2 RED: create `test/inventory-write.test.mjs` — price-only (stock 0) writes; positive stock add additive; lot-only skips; no-op skips; `minimum`-only edit on EXISTING product writes (W1); `lote` omitted when delta 0 / trimmed when delta > 0; echo within 5s does not add stock.
- [x] 1.3 Add `"test:inventory": "node --experimental-strip-types --test test/inventory-write.test.mjs"` to `package.json`.
- [x] 1.4 GREEN: satisfy 1.2. **Commit (FE unit 1)**: helpers + tests + script.

## Phase 2: Frontend wiring (A/B/D + error surfacing)

- [x] 2.1 `products.store.ts:210` add `opts?: { strict?: boolean }`; strict rethrows on request failure (default stays `null`-on-miss).
- [x] 2.2 `products.store.ts` replace `:323-327` delta-vs-absolute compare with server-resolved absolute compare (W3 gate).
- [x] 2.3 `products.store.ts` `saveMedicine` decision table: `found` write when `stockDelta≠0` OR pricing changed (price/minimum/discount/base_price/profit); lot-only (`0`,`no`,`yes`) and no-op skip; `missing` write when `stockDelta≠0` OR `hasPricing` (`minimum` only when `>0`); `error` → return `false`, no write.
- [x] 2.4 `products.store.ts:329` build item via `buildIncreaseItem`: delta additive; price fields; `lote`/expiry only when `delta > 0`; price-only omits `lote`.
- [x] 2.5 `products.store.ts:342-344` on `increaseInventory` throw: revert optimistic `inventory`, set `recentMutations[barCode]=Date.now()`, return `false`.
- [x] 2.6 `useCreateProduct.ts:92-93` drop `quantityVal > 0`; call when `pharmacyId && barCode && (qty>0 || hasPricing)`; stock stays delta.
- [x] 2.7 `BulkImportDialog.tsx:224-234` replace `stock>0` filter with `stock>0 || hasPricing`; update `:229` warning to "no stock/pricing".
- [x] 2.8 `MqttInventoryProvider.tsx:126` skip `stock + quantity` when `now - recentMutations[barCode] <= 5000`; still apply price/metadata (`:127`).
- [x] 2.9 Surface link failure in `useCreateProduct` (no success on error). **Commit (FE unit 2)**: 2.1-2.9; `npm run test:inventory && npm run build`.

## Phase 3: Backend propagation (C)

- [x] 3.1 `medications_agent/.../repositories.rs` add propagation batch AFTER both update and insert/create branches (after `:518-557`); only items with `lote == None` and `price > 0`.
- [x] 3.2 Propagate `{price, base_price, profit_percentage, discount}` to all `(pharmacy_id, product_id)` rows via string-cast binds `$php/$phb/$prp/$prb`; keep `{stock, minimum, lote, expiry}` row-scoped; do NOT propagate `minimum` (W1).
- [x] 3.3 RED: `medications_agent/src/test.rs` SQL-shape test (propagation has no `lote =` filter, gated `price>0`); `phamacy_action` string test asserting `low_stock` SQL (`:989-997`) references no price.
- [x] 3.4 RED `#[ignore = "requires SurrealDB"]` DB tests: multi-lot lower→listing new price; single-row decrease then increase; `price=0` keeps stored price; stock-add additive; import-stock stays lote-scoped; **W2b** no-lote save creates no new lot row and keeps labels `L-2026-01`/`L-2026-02` unchanged.
- [x] 3.5 GREEN: implement 3.1-3.2; confirm consumers unbroken — `phamacy_action/...:872`, `:942`, `:981`, `:989-997`, `:1077`; `inventory_movements/...:173`; `pharmacy_search/...:276`.
- [x] 3.6 `docs/api/MedicationsAgent.md` document no-lote propagation. **Commit (BE unit 3)**: repositories.rs + test.rs + doc; `cargo test -p medications_agent -p phamacy_action`.

## Phase 4: Verification & delivery

- [ ] 4.1 `npm run test:inventory` green from clean checkout.
- [ ] 4.2 `cargo test -p medications_agent -p phamacy_action`; then `-- --ignored` against SurrealDB.
- [ ] 4.3 Manual E2E: lower water-jug price to 1100, save, refresh; `GET /admin/Pharmacy/{id}/medications/cursor?query=<barCode>` returns 1100.
- [ ] 4.4 Open one PR per repo (FE→`master`, BE→`dev`); verify BE base is `dev` (local branch is currently `feat/product-name-lc-consistency`).

### Spec verification map (one task per requirement)

- [ ] V1 `inventory-price-persistence` PERSIST-1 (current page / absent page / genuinely new) — 4.3.
- [ ] V2 PERSIST-2 (single-row decrease→increase / multi-lot decrease / reporting consumers) — 3.4.
- [ ] V3 PERSIST-3 write fails → UI failure, no success — 2.5.
- [ ] V4 PERSIST-4 save then echo → stock 15 not 20 — 2.8.
- [ ] V5 PERSIST-5 (positive stock add / bulk import with stock / minimum-discount edit) — 2.6-2.7.
- [ ] V6 PERSIST-6 (zero/absent price keeps 1500 / derivation unchanged) — 3.4 + `npm run test:pricing`.
- [ ] V7 `inventory-pricing-fields` PRICING-1 (enters values / price-only zero stock / blank) — 2.1-2.4.
- [ ] V8 PRICING-2 (create values / price-only create zero stock / blank) — 2.6, 2.9.
- [ ] V9 PRICING-3 (price-only imported row / positive stock / neither) — 2.7.
- [ ] V10 `inventory-lot-tracking` LOT-1 (add stock with lot / blank lot / price-only carrying lot omits it / lot-only no fire) — 1.2, 2.4.
- [ ] V11 LOT-2 (no new lot row / existing lots keep labels) — 3.4.
