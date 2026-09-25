# Proposal: Fix Price Source Consistency

## Intent

The operator reports "in stock it shows one price and in the register (caja) it shows
another; it doesn't take price updates". Verified reconciliation for `BOTELLON DE AGUA
RECARGA`:

- Panel (`StockFeaturesForm.tsx:72-86`) shows a **derived** preview
  `sellingPrice(0.8, 40, VAT 0%) = 1.3333 USD = 1140.88 Bs` (`pricing.ts:7-12`).
- Caja charges the **stored** `pharmacy_inventory.price = 1.55 USD = 1326.28 Bs`
  (`fiscal-totals.ts:42`, `money.ts:21-23`).
- `1.55 = round2(sellingPrice(0.8, 40, VAT 16%))` (`pricing.ts:40-47`).

Two representations of "the price" exist and **nothing links them**. The panel never renders
`currentMedicine.price` (`StockFeaturesForm.tsx:97`), so the operator edits cost/profit/VAT and
watches a preview that is not the charged number.

## Why Now

Operators cannot trust the price the register charges, and the UI displays a preview that is
not what is billed (1140.88 vs 1326.28 Bs). A silent no-op save can report "Producto Agregado"
while skipping the inventory write (`products.store.ts:327-336`).

## Scope

### In Scope

- **Enforce one invariant at the backend write layer**: `price = derived(base_price,
  profit_percentage, vat)`, recomputed and persisted on every pricing write. Covers all
  writers found by exploration:
  - `medications_agent/.../repositories.rs:295-315`, `:320-334`, `:336-371`
    (increase set-clauses), `:1274-1291`, `:1318-1338` (Excel import-stock).
  - `phamacy_action/.../repositories.rs:735-744` (`batch_add_medications`, price-only).
  - `purchase_invoices/.../purchase_invoices_impl.rs:125-134`, `:156-165` (per-lot rows).
  - `delivery_note/.../repositories.rs:518-529` (per-lot rows).
  - Catalog create path that silently discards `price`/`basePrice`/`profitPercentage`
    (`repositories_products.rs:264-381`; FE sends them at `products.service.ts:106-133`).
- **Move VAT to per-pharmacy inventory** as an authoritative pricing input: transport,
  storage, validation, calculation, and FE edit surface. Today VAT is catalog-only
  (`repositories.rs:815`, `vat: product.vat`) and never travels with the price write
  (`inventory-write.ts:18-24`,`:104-143`). Mechanism decided in DESIGN.
- **Fix concrete FE bugs**: `TabCreateProduct.tsx:275,288` `parseInt(vat) || 16` coercing a
  legitimate `0%` into `16%`; align FE derivation (`pricing.ts:11` includes VAT) with backend
  `derived_selling_price` (`repositories.rs:114-125`, excludes VAT).
- **Backfill** existing divergent rows: **required**, **reversible**, **rehearsed on a
  snapshot** before touching real data.
- **Make panel and register read the same number**: surface the stored price as the charged
  price (or prove equality by construction).

### Out of Scope

- Changing `math::max(price)` listing semantics (deliberate LOT-REQ-006) or read-path rework.
- Redesigning fiscal/printer flow; currency/rate handling unchanged.
- New pricing model beyond the invariant; `price = 0` stays unsettable
  (`medications_agent/.../repositories.rs:527`).

## Capabilities

### New Capabilities

- `inventory-price-derivation`: the backend invariant `price = derived(base_price,
  profit_percentage, vat)` enforced at every pricing writer, with VAT authoritative per
  pharmacy inventory.

### Modified Capabilities

- `inventory-price-persistence`: persisted price MUST equal the derived price for all writers.
- `inventory-pricing-fields`: `vat` joins the per-inventory pricing family; NULL handling.
- `inventory-lot-tracking`: per-lot purchase-invoice/delivery-note price semantics under the
  invariant.

## Approach

- **BE derive + invariant (area A)**: single derivation function; every writer recomputes
  `price` from `(base_price, profit_percentage, vat)` before persisting.
- **BE VAT per-pharmacy (area B)**: add `vat` to inventory (`ModelInventory`), thread it
  through the increase/import/purchase/delivery contracts, read it in the listing
  (`repositories.rs:871-881`).
- **FE alignment/surface (area C)**: unify the derivation definition, remove the `|| 16`
  coercion, include `vat` in `PricingSnapshot`/`buildIncreaseItem`, render stored price.
- **Backfill (area D)**: reversible script over `pharmacy_inventory`, snapshot-rehearsed.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `modules/products/lib/pricing.ts` | Modified | unify derivation incl. VAT defaults |
| `modules/products/lib/inventory-write.ts` | Modified | carry `vat` in `PricingSnapshot` |
| `modules/products/components/StockFeaturesForm.tsx` | Modified | edit VAT, render stored price |
| `modules/products/components/TabCreateProduct.tsx` | Modified | drop `\|\| 16` coercion (`:275,288`) |
| `modules/products/store/products.store.ts` | Modified | stop silent no-op skip (`:327-336`) |
| `modules/products/components/BulkImportDialog.tsx`, `hook/useCreateProduct.ts` | Modified | VAT/pricing write alignment |
| `modules/cash-register/*` | Read | charged price already stored-value |
| BE `medications_agent/.../repositories.rs` | Modified | derive + persist invariant (5 sites) |
| BE `phamacy_action/.../repositories.rs` | Modified | VAT in listing; batch-add derive |
| BE `medications/.../repositories_products.rs` | Modified | catalog create price handling |
| BE `purchase_invoices/...`, `delivery_note/...` | Modified | per-lot derive |
| BE `inventory_movements/...`, `pharmacy_search/...` | Read | `math::max(price)` consumers |
| `test/pricing.test.mjs` (`:44`), `src/http/src/price_propagation_e2e.rs` | Modified | contract change + consistency tests |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Six writers + listing + `math::max` consumers (`resumen.valor_venta:978-987`, movement `:173`, PDF) | High | single derivation helper; contract tests; no read-semantics change |
| Backfill corrupts real data | High | reversible script, snapshot rehearsal, dry-run diff |
| `test/pricing.test.mjs:44` pins the VAT default | Med | deliberate, visible contract change (default is 0%, not 16%) |
| Per-lot purchase-invoice intent unknown (open question) | Med | decide in spec/design |
| Repos in active E2E use; FE detached HEAD | Med | no clean-tree assumption; explicit snapshot |

## Backfill / Rollback

Backfill script recomputes `price` for every divergent row from current inputs, logs a
before/after diff, and is reversible (stores prior values). Rollback: revert both PRs, restore
the pre-backfill snapshot; no destructive read-semantics change means old code still reads
restored values.

## Dependencies

- Backend edit authority (repo `Backend-administrativo` @ `dev`) granted at apply.

## Delivery

- `delivery_strategy = auto-chain`, `chain_strategy = stacked-to-main`, review budget **400
  lines**. This change is **very likely to exceed 400 lines** (backend writers + VAT transport
  + FE + migration).
- Suggested split: (1) BE derive + invariant → (2) BE VAT per-pharmacy → (3) FE surface/
  alignment → (4) backfill script.

## Success Criteria

- [ ] After a price/cost/profit/VAT edit, panel == register == stored `price` ==
      `derived(base_price, profit_percentage, vat)`, single-lot and multi-lot, in USD and Bs.
- [ ] A `0%` VAT stays `0%` through create and save (no `|| 16` coercion).
- [ ] Backfill reconciles existing divergent rows and is reversible.
- [ ] No regression in `resumen.valor_venta`, movement snapshots, PDF reports.

## Open Questions

1. Which row(s) exist for `BOTELLON DE AGUA RECARGA` (`price`, `base_price`,
   `profit_percentage`, `lote`, `vat`)? (blocking)
2. Do purchase-invoice/delivery-note lot prices mean product-level intent or per-lot cost?
3. What are `11` and `7Frasco` in the panel screenshot?
4. Handling of legacy rows with NULL inputs during backfill (skip vs derive)?
