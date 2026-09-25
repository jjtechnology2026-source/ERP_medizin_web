# Proposal: Fix Product Price Update

## Intent

Report: lowered the water-jug price to 1100 Bs in the edit modal; UI showed success (`modules/products/components/StockFeaturesForm.tsx:534`) but the stored price did not change. Four verified causes:

- **A** `modules/products/hook/useCreateProduct.ts:92` sends the price-carrying `increaseInventory` only when `stock > 0`; price-only saves never persist price. Same at `modules/products/components/BulkImportDialog.tsx:224-229`.
- **B (reported case)** `modules/products/store/products.store.ts:279` checks "exists" on the current page only (`INVENTORY_PAGE_SIZE = 10`, `:11`); catalog-sourced products count as NEW — the price-less catalog upsert runs and `increaseInventory` `:329` is skipped.
- **C** the listing exposes `math::max(price)` (`.../phamacy_action/.../repositories.rs:872`) while a no-lote edit writes only the SIN LOTE row (`.../medications_agent/.../repositories.rs:521-531`); a LOWER price never wins MAX.
- **D** `modules/products/providers/MqttInventoryProvider.tsx:126` re-adds a delta already applied at `products.store.ts:307` (local only).

Write failures are swallowed and `true` returned (`products.store.ts:342-344`). **Why now:** operators cannot correct prices downward; false success erodes trust.

## Scope

**In**
- **B** resolve existence server-side (`findInventoryItem`, `:210`); always run the write for existing products.
- **A** ungate price/minimum/discount/base_price/profit from `stock > 0`; stock stays additive.
- **C (cross-repo)** make lowering no-lote edits visible; MUST NOT break `low_stock`, `resumen`/`valor_venta`, PDF reports or other `math::max(price)` consumers (`:551`, `:1077`; `.../inventory_movements/.../repositories.rs:173`). Route: design.
- **D** stop the MQTT echo re-add.

**Out**
- `price = 0` stays unsettable (`.../medications_agent/.../repositories.rs:527`); USD/Bs currency UX and cost→price derivation unchanged (`lib/pricing.ts:29-38`).
- No pricing-model redesign; no new endpoint unless minimal.

## Capabilities

**New** `inventory-price-persistence` — existing-product price edits persist from every entry point.
**Modified** `inventory-pricing-fields` (price write MUST fire without a stock delta); `inventory-lot-tracking` (SIN LOTE vs lot-row write scope).

## Affected Areas

| Area | Impact |
|---|---|
| FE `modules/products/{store/products.store.ts, hook/useCreateProduct.ts, providers/MqttInventoryProvider.tsx, api/products.service.ts, components/BulkImportDialog.tsx}` | Modified (A/B/D) |
| BE `Backend-administrativo/src/features/medications_agent/src/infrastructure/repositories.rs` | Modified (C) |
| BE `Backend-administrativo/src/features/phamacy_action/src/infrastructure/repositories.rs` | Read/Modified (C) |
| BE `Backend-administrativo/src/features/inventory_movements/src/infrastructure/repositories.rs` | Read (C) |

## Risks

| Risk | Mitigation |
|---|---|
| Destructive multi-row writes (C) (`modify-products/SKILL.md:27`) | narrowest option; pre/post row check |
| `increaseInventory`: 3 call sites | stock-add and bulk-import tests |
| Backend edit authority absent | user grants it at apply (`dev`) |

## Rollback Plan

Revert both PRs (frontend `master`, backend `dev`); no migration. Snapshot pre-edit rows before C.

## Success Criteria

- [ ] Lowering an existing price (single-row and multi-lot) persists after refresh.
- [ ] Price-only save (stock 0) calls `increaseInventory`; failures surface.
- [ ] Stock adds, min/discount edits, bulk import unregressed; no double-count.
- [ ] `GET /admin/Pharmacy/{id}/medications/cursor?query=<barCode>` returns the new price.

## Open Questions

**Open:** price to all lot rows or SIN LOTE only? Read-aggregation redefinition vs bounded write propagation?

## Delivery

`delivery_strategy = auto-chain`, budget 400 lines. Forecast frontend ~200-250 + backend ~100-200 → likely over; chain frontend → `master`, backend → `dev`.
