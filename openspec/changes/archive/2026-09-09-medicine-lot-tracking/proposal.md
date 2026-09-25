# Proposal: Medicine Lot Tracking — Stock Intake (Frontend)

## Intent

Frontend slice of the cross-repo `medicine-lot-tracking` change. Capture an optional text-only lot label (`lote`) at every per-pharmacy **stock intake** in `ERP_medizin_web` and forward it on the `increaseInventory` payload. The backend owns the sale side (strict FIFO derivation + lot stamped on persisted order lines); the frontend checkout flow does NOT change. Blank/absent lots degrade to the backend "SIN LOTE" bucket, so legacy stock and every existing intake path keep working.

## Scope

### In Scope
- Optional `lote` on `increaseInventory` items and all three call sites (service, store, hook).
- TS types: `Medication` (form carrier), `BulkProductRow`, `MedicationData`.
- Forms: `StockFeaturesForm` (add-stock) and `TabCreateProduct` (initial stock) gain an optional Lote input.
- `BulkImportDialog`: optional Excel "Lote" column in template, parse, and post-link increase.

### Out of Scope
- FIFO/auto-lot resolution and sale-line lot stamping (backend-owned, per cross-repo split).
- Checkout UI, order payload, `buildModelOrder` whitelist (`current-order.store.ts:384-403`), `orders/types/orders.ts` `Medication`.
- Lot in the inventory read model / cursor / any UI (total stock stays aggregated per `barCode`).
- Expiry dates, lot report UI, proto changes (increase is HTTP-driven; see design).

## Capabilities

### New Capabilities
- `inventory-lot-tracking`: Optional text-only lot (`lote`) captured on frontend stock-intake flows and forwarded on inventory-increase items; blank/absent degrades to backend "SIN LOTE".

### Modified Capabilities
- None (no existing spec covers stock intake).

## Approach

Single-word key `lote` — identical under camel and snake conventions, so no mapping. Optional `string | null`; empty/blank values are trimmed and omitted (encoded as null, mirroring the `base_price` pattern at `products.service.ts:92-93,156`). Blank never blocks a save. The Excel column is optional: `getCol` returns `""` → `undefined` → omitted → backend bucket.

Frontend (`ERP_medizin_web`):
1. `modules/products/types/products.types.ts` — `Medication` + `BulkProductRow` gain `lote?: string`.
2. `modules/products/api/products.service.ts` — `increaseInventory` item type (l.156) gains `lote?: string | null`; catalog `createProduct` payload unchanged.
3. `modules/products/store/products.store.ts` — `saveMedicine` increase item (l.264-272) forwards trimmed `medicine.lote`; change-detection (l.257-273) NOT extended (lot belongs to the stock delta).
4. `modules/products/hook/useCreateProduct.ts` — `MedicationData` (l.6-28) + initial-stock increase item (l.87-98).
5. `modules/products/components/StockFeaturesForm.tsx` — optional Lote input (state l.25-29, medicine object l.91-100).
6. `modules/products/components/TabCreateProduct.tsx` — optional Lote input in Precio-y-Stock grid (l.544-588) + payload (l.272-283).
7. `modules/products/components/BulkImportDialog.tsx` — template header (l.30-47), parse (l.145-163), post-link increase (l.212-223).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `modules/products/types/products.types.ts` | Modified | `Medication`/`BulkProductRow` gain `lote?: string` |
| `modules/products/api/products.service.ts` | Modified | `increaseInventory` item type gains `lote?: string \| null` |
| `modules/products/store/products.store.ts` | Modified | `saveMedicine` increase item forwards lote |
| `modules/products/hook/useCreateProduct.ts` | Modified | `MedicationData` + increase item forward lote |
| `modules/products/components/StockFeaturesForm.tsx` | Modified | Optional Lote input |
| `modules/products/components/TabCreateProduct.tsx` | Modified | Optional Lote input (initial stock) |
| `modules/products/components/BulkImportDialog.tsx` | Modified | Optional Excel Lote column (template/parse/increase) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| In-flight `excel-bulk-import-pharmacy-inventory` (blocked verify) edits the same `BulkImportDialog` regions + increase seam | Med | Additive optional column; sequence this change after it merges; overlap is ~3 lines in template headers + post-link map |
| Backend DTO field-name mismatch | Low | Cross-repo contract fixed to `lote`; absent field degrades to bucket |
| Lot-only edit never fires increase (store change-detection l.257-273) | Low | By design: lot rides the stock delta; a 0-quantity save is a no-op |
| Stale `lote` lingers in a zustand-persisted flat row | Low | No read path/UI consumes lote; next cursor fetch replaces the row |

## Rollback Plan

Revert the single frontend PR. `lote` is optional on every surface: no payload is required to change, no data migration, no persisted frontend behavior. Existing intakes without lote keep working (backend "SIN LOTE" bucket). Nothing on the sale side is touched, so no checkout regression path exists.

## Dependencies

- Backend `IncreaseMedicationItem` accepts `lote?: string | null` per the cross-repo agreement (absent → SIN LOTE). Not a hard blocker: sending an unknown field today is ignored server-side until the backend change lands.
- Sequencing: `medicine-lot-tracking` apply should follow `excel-bulk-import-pharmacy-inventory` merge to avoid same-file conflicts in `BulkImportDialog.tsx`.

## Success Criteria

- [ ] All three intake call sites forward a non-empty trimmed `lote` and omit it when blank
- [ ] Both forms render an optional Lote input; empty submit succeeds (SIN LOTE)
- [ ] Excel template/parse/post-link support an optional Lote column; files without it import unchanged
- [ ] Catalog `createProduct` payload and checkout/order payloads are byte-identical to today
- [ ] `pnpm build` type-checks cleanly; inventory read model untouched
