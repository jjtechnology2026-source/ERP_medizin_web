# Exploration: `fix-product-price-update`

> Symptom (reported by the pharmacy operator): editing the price of an EXISTING
> product reports success, but the persisted price does not change. Example given:
> lower the price of the water jug (`botellón de agua`) to 1100 Bs.
> Artifact store: hybrid (Engram + OpenSpec). Language: English.
> Phase: read-only. No source code was modified to produce this artifact.

## Repo topology

Two separate git repositories, both read during exploration:

- **Frontend** (this SDD project, cwd): `/home/enzo/medizin/ERP_medizin_web` — Next.js 16 App Router, TypeScript, Zustand, `modules/products/`.
- **Backend** (sibling repo): `/home/enzo/medizin/Backend-administrativo` — Rust (Actix) + SurrealDB, `src/features/medications/`, `src/features/medications_agent/`, `src/features/phamacy_action/`.

---

## 1. Current State — where the price actually lives and who writes it

### 1.1 The displayed inventory price comes from `pharmacy_inventory`, not the catalog

- The inventory list calls `GET /admin/Pharmacy/{id}/medications/cursor`
  (`ERP_medizin_web/modules/products/api/products.service.ts:91-93`).
- Handler: `cursor_pharmacy_medications` — `Backend-administrativo/src/features/phamacy_action/src/infrastructure/controllers/cursor_pharmacy_medications.rs:55`.
- The page SQL aggregates **per product** and projects `math::max(price) AS price`:
  `pharmacy_inventory_page_sql` — `.../phamacy_action/src/infrastructure/repositories.rs:872`.
  Fast path uses the same idea in Rust: `agg.price = agg.price.max(r.price)` — same file `:942`.
- The catalog table `products` has **no** `price`/`stock`/`minimum`/`discount` fields:
  `ModelProduct` — `Backend-administrativo/src/shape/src/models/model_product.rs:6-21`.

**Conclusion:** the price the operator sees in the inventory is `MAX(pharmacy_inventory.price)`
across all lot rows of that product for that pharmacy (grouped per `product_id`).

### 1.2 Only one endpoint persists a per-pharmacy price

- `POST /admin/MedicationsAgent/increase` is the only writer of
  `pharmacy_inventory.price` used by the frontend
  (`products.service.ts:196`; handler `.../medications_agent/src/infrastructure/controllers/increase_inventory.rs:67`).
- Repository update: `UPDATE pharmacy_inventory SET stock += $si, price = IF $pi > 0 THEN $pi ELSE price END, minimum = $mi, discount = $di, base_price = $bpi, profit_percentage = $ppi ... AND lote = $lo`
  — `.../medications_agent/src/infrastructure/repositories.rs:526-531`.
- `POST /Medications/Create` (catalog) **cannot** write a price: the update branch only sets
  `name, brand, activeIngredient, dosage, tablets, image, category, subcategory, description, controlled, antibiotic, vat, search_document`
  — `.../medications/src/infrastructure/repositories/repositories_products.rs:329-338` (and the single-record
  `update_existing_product` `:220-232`). `aux_to_product` drops `price`/`stock`/`minimum`/`discount`
  entirely — same file `:201-218`.
- The frontend has **no dedicated price-update endpoint**. `products.service.ts` exposes only
  `createProduct` (`:106`), `updateName` (`:191`), `increaseInventory` (`:196`), `deleteProduct` (`:186`).

**Backend contract for edits** (`Backend-administrativo/.agents/skills/modify-products/SKILL.md`):
- Rule: "`price` and `stock` are NOT fields of `products`. They live in `pharmacy_inventory`..." (line 19).
- Decision gate: "Set price + stock per pharmacy (JSON) → `POST /admin/MedicationsAgent/increase`" (line 39).
- `references/pharmacy-inventory-http.md:36`: "`price` absent/`null` means 'do not change the stored price'."
  (In code this is implemented as `price = IF $pi > 0 THEN $pi ELSE price END`, so price `0` also preserves
  the stored value — see test `increase_with_zero_price_keeps_stored_price`,
  `.../medications_agent/src/test.rs:490-550`.)

---

## 2. Root causes of "success but price does not change"

Four distinct mechanisms were found. They are not mutually exclusive; A and C are the strongest
matches for the report.

### Root cause A — create/submit paths gate the inventory (price) write on `stock > 0` (frontend)

- `ERP_medizin_web/modules/products/hook/useCreateProduct.ts:92`
  `if (pharmacyId && quantityVal > 0) { await productsService.increaseInventory(...) }`
  where `quantityVal = parseInt(baseData.stock) || 0` (`:91`).
- The "Crear Producto" form submits through this hook: `TabCreateProduct.handleSubmit`
  (`.../components/TabCreateProduct.tsx:269-325`) sets `stock: formData.stock || "0"` (`:286`) and,
  on success, shows **"Producto creado exitosamente. Redirigiendo..."** (`:322`).
- Therefore a price-only submit (same `barCode`, stock left at 0/empty) calls only
  `POST /Medications/Create`; the catalog upsert succeeds but drops `price`, and the inventory
  write that carries the price is never attempted. HTTP 200 → success message → price unchanged.
- Same gating in bulk import: `BulkImportDialog.tsx:224-229` (only rows with `stock > 0` are linked).

This mechanism is deterministic for any product, single row or multiple, and its success message
matches the operator's wording ("product created").

### Root cause B — `saveMedicine` treats a product absent from the current page as NEW (frontend)

- `ERP_medizin_web/modules/products/store/products.store.ts:279`
  `const existing = inventory.find((m) => m.barCode === medicine.barCode && m.barCode);`
- `inventory` holds only the current page (`INVENTORY_PAGE_SIZE = 10`, `products.store.ts:11`).
- When `existing` is `undefined` (product not on the current page, product not yet in the pharmacy,
  or empty `barCode`), the code runs **only** `createProduct` (`:283`) and skips the
  `increaseInventory` block at `:329` → price never reaches `pharmacy_inventory`.
  The success dialog still shows "Producto Agregado" (`StockFeaturesForm.tsx:534`).
- This is the likely path when the operator reaches the form from catalog search
  (`TabSearchPage.tsx:147-148` sets `editMode=false`, `view=STOCK_FEATURES`) or from
  "Agregar Producto a Stock" (`index.tsx:26-30`).

### Root cause C — displayed price is `math::max(price)`, so a LOWER price loses against older lot rows (backend)

- Listing aggregates `math::max(price)` per product (`.../phamacy_action/.../repositories.rs:872`), and
  the fast path does `agg.price.max(r.price)` (`:942`).
- A price edit with no `lote` writes **only the SIN LOTE bucket** (`.../medications_agent/.../repositories.rs:447-463`
  route matched rows; `:526-531` the UPDATE), or CREATES a new stock-0 SIN LOTE row when the bucket
  does not exist (`:464-483`).
- If the product has more than one `pharmacy_inventory` row (per-lot rows created by lot tracking),
  a newly written **lower** price never wins `MAX` → the list still shows the old higher price.
  Raising the price would appear to work; **lowering** appears to do nothing — exactly the
  "make it cheaper" scenario in the report.
- This is a backend read/write mismatch. It cannot be fixed from the frontend alone, because the
  frontend does not know the product's lot rows.
- The per-product grouping with `math::max` is a deliberate lot-tracking decision (comment at
  `.../phamacy_action/.../repositories.rs:857-860`, tagged `LOT-REQ-006`).

### Root cause D — local stock double-count on the MQTT echo (frontend, adjacent)

- `saveMedicine` optimistically adds the delta locally: `stock: (m.stock ?? 0) + (medicine.stock ?? 0)`
  (`products.store.ts:307`).
- The backend fires `insert_inventory` after the increase (`increase_inventory.rs:120-127`), and
  `MqttInventoryProvider.tsx:126` does `stock: (existing?.stock ?? 0) + quantity` **again**.
  Price is set from `med.price` (`:127`), so this does not hide the price, but it doubles local stock
  until the next server fetch. Note: the DB itself is not double-counted — `/Medications/Create`
  never writes `stock` (catalog has no stock), so the only stock writer is `increase` (`stock += delta`).

---

## 3. Is this frontend-only or cross-repo?

- Root causes **A, B, D** are entirely inside `/home/enzo/medizin/ERP_medizin_web`.
- Root cause **C** is inside `/home/enzo/medizin/Backend-administrativo`
  (`pharmacy_inventory_page_sql` / `group_rows_by_product` and/or the write targeting in
  `increase_inventory`).
- Whether C is in scope depends on whether the operator's product has more than one
  `pharmacy_inventory` row (see Open Questions). If it does, a robust fix must touch the backend,
  which means `allowedEditRoots` (currently frontend-only) has to be extended, or the change must
  explicitly scope out multi-lot products and document the residual defect.

**Explicit answer:** the symptom is *at least partially* cross-repo. A frontend-only change can fix
A/B/D and make price-only edits reach the inventory API, but it cannot fix the `MAX(price)` display
for multi-lot products.

---

## 4. Affected code locations (every writer/reader of an existing product's price)

Frontend (`ERP_medizin_web`):
- `modules/products/hook/useCreateProduct.ts:88-109` — inventory link guarded by `quantityVal > 0` (`:92`).
- `modules/products/components/TabCreateProduct.tsx:269-325` — create-only submit + success message (`:322`).
- `modules/products/store/products.store.ts:277-348` — `saveMedicine`; `existing` lookup (`:279`),
  create-vs-edit (`:281-299`), optimistic stock add (`:301-313`), `changed` gate (`:323-327`),
  `increaseInventory` call (`:329-339`).
- `modules/products/components/StockFeaturesForm.tsx:96-134` — edit submit, derived price (`:112-125`),
  success dialog (`:527-551`).
- `modules/products/api/products.service.ts:106-133` (`createProduct`), `:196-201` (`increaseInventory`).
- `modules/products/components/BulkImportDialog.tsx:210-266` — inventory link only for `stock > 0` (`:225-229`).
- `modules/products/providers/MqttInventoryProvider.tsx:119-128` — local upsert/echo (price `:127`, stock `:126`).
- `modules/products/components/TabInventory.tsx:81-85` — the only edit entry point (`STOCK_FEATURES`).
- `modules/products/components/TabSearchPage.tsx:147-148` — catalog-sourced form (`editMode=false`).

Backend (`Backend-administrativo`):
- `.../medications_agent/src/infrastructure/controllers/increase_inventory.rs:78-101` — DTO→proto mapping
  (`price: item.price.unwrap_or(0.0)` at `:92`).
- `.../medications_agent/src/adapters/dto.rs:18-39` — `IncreaseMedicationItem` (`price: Option<f64>` `:26`).
- `.../medications_agent/src/infrastructure/repositories.rs:443-483` — row selection (SIN LOTE vs new row);
  `:518-557` — the price/stock UPDATE (`price = IF $pi > 0 ...` `:527`).
- `.../medications/src/infrastructure/repositories/repositories_products.rs:264-363` — catalog upsert
  (no price), `:201-218` `aux_to_product` (drops price).
- `.../phamacy_action/src/infrastructure/repositories.rs:861-911` and `:917-956` — `MAX(price)` display.

---

## 5. Correct approach (per the `modify-products` skill contract)

- A per-pharmacy price edit **must** go through `POST /admin/MedicationsAgent/increase` with
  `price = <new price>` and `stock = 0` (delta). The backend accepts `stock = 0`
  (`increase_inventory.rs:279-286`), and `price > 0` is persisted by
  `price = IF $pi > 0 THEN $pi ELSE price END` (`repositories.rs:527`).
- `POST /Medications/Create` must never be relied on for price — the catalog has no price field.
- Two viable shapes:

| Approach | Scope | Pros | Cons | Effort |
|---|---|---|---|---|
| 1. Frontend-only: fix A + B + D (remove the `stock > 0` guard for price-only edits; resolve `existing` via `findInventoryItem` instead of the current page; fix the echo double-count) | frontend | closes the "success without persisting" defect for single-row products; no backend edits; fits current `allowedEditRoots` | does not fix C; lowering price on multi-lot products still shows stale price | Low/Med |
| 2. Cross-repo: (1) + backend change so a no-lote price edit updates the price fields on **all** rows of the (pharmacy, product) pair (stock still only on the SIN LOTE bucket), or add a dedicated price-set endpoint | both repos | fixes the actual "make it cheaper" case regardless of lots | touches multi-row writes (skill flags multi-row writes as destructive); needs `allowedEditRoots` extension; larger blast radius | Med/High |
| 3. Backend read-only: stop using `math::max(price)` in the listing | backend | one-line-ish | changes LOT-REQ-006 semantics, low-stock filters, resumen aggregates and the PDF report; does not fix A/B | Med but risky |

**Recommendation:** Approach 2, but explicitly scoped: land Approach 1 first (frontend, fixes the
deterministic "success but no persist"), then a minimal backend change that propagates a no-lote
price edit to every row of the product. Confirm with the operator whether the water jug has lot rows
before deciding whether the backend half is required. Avoid Approach 3 (it is the broadest and
changes reporting numbers).

---

## 6. Edge cases

- **Stock = 0 price-only edit:** the inventory API accepts it (test `validate_stock_zero_accepted`,
  `increase_inventory.rs:279-286`); the frontend does not always send it (Root cause A).
- **Delta vs absolute stock on edit:** the store sends `stock: stockVal` as a **delta** to
  `increase` (`products.store.ts:319,331`) while `createProduct` receives `stock: existing.stock`
  as an **absolute** (`:292`). The catalog drops stock, so there is no DB double-count; the local
  optimistic add (`:307`) is a delta on top of the existing value, consistent with the DB.
- **Products without `barCode`:** `existing` is never matched (`products.store.ts:279` guard
  `&& m.barCode`), so the edit degrades to catalog-create-only and the price is dropped.
- **`discount` / `basePrice` / `profitPercentage`:** carried by `increaseInventory`
  (`products.service.ts:196`) and persisted by the same UPDATE (`repositories.rs:527-528`);
  they share root cause C when the product has multiple lot rows.
- **The `changed` comparison** (`products.store.ts:323-327`) compares the stock **delta** against
  the **absolute** `existing.stock`, so it is almost always `true`; it does not gate price updates
  off, but it is semantically wrong and will report "changed" for no-op saves.
- **Local stock double-count (D):** the MQTT echo re-adds the delta (`MqttInventoryProvider.tsx:126`).
- **Price `0` cannot be set through the API:** `price = IF $pi > 0 THEN $pi ELSE price END`
  (`repositories.rs:527`) means an explicit `0` is ignored. The test asserts this is intentional
  (`test.rs:488-490`).
- **Backend Excel import** (`apply_pharmacy_medication_stock`, `repositories.rs:898+`) derives the
  price from `base_price`/`profit_percentage` (`derived_selling_price`, `:113-124`) and only
  reconciles the `lote IS NONE` bucket (`:961`); it is a separate writer, not used by the frontend UI.

---

## 7. Reproduction and verification

Reproduction (UI):
1. Sign in with a user whose profile has a `pharmacyId`.
2. Open Productos → inventory (`app/(secciones)/(general)/productos/page.tsx` → `modules/products/index.tsx`).
3. Find "Botellón de agua" and trigger the edit path (`TabInventory.handleEdit`, `TabInventory.tsx:81-85`).
4. Lower "Costo (sin IVA)" and/or "Ganancia (%)" so the derived final price is lower than the
   current one; leave "Agregar al stock (+)" empty (0). Press "Confirmar"/"Actualizar Stock".
   - Alternative: open "Crear Producto", enter the same `barCode` and the new price with stock 0, submit.
5. Observe the success UI ("Producto Agregado" / "Producto creado exitosamente").
6. Return to the list and refresh: the price is unchanged.

Passing verification:
- After the fix, `GET /admin/Pharmacy/{id}/medications/cursor?query=<barCode>` must return the new
  (lower) price for the product, and the list must show it after reload.
- Frontend unit level: assert the payload builder calls `increaseInventory` with `price = <new>`
  when the stock delta is 0.

Test tooling present:
- `ERP_medizin_web/package.json:14` `test:pricing` → `node --experimental-strip-types --test test/pricing.test.mjs`.
- `ERP_medizin_web/package.json:12` `test:fiscal` (three `test/*.test.mjs` files).
- No component/integration test infra on the frontend; these are Node test-runner unit tests.
- Backend DB-level tests exist but are `#[ignore = "requires SurrealDB"]`
  (e.g. `.../medications_agent/src/test.rs:490-550`).

---

## 8. Risks / blast radius

- `increaseInventory` is called from three places (`useCreateProduct.ts:93`, `products.store.ts:329`,
  `BulkImportDialog.tsx:234`); changing its contract or the no-lote write behavior affects stock
  adds and bulk import, not just price edits.
- `saveMedicine` is called only from `StockFeaturesForm.tsx:127`; `createProduct` also from
  `bulkImportWithProgress` (`products.service.ts:157`).
- Root cause C's fix touches multi-row writes; the `modify-products` skill explicitly warns that
  "Multi-row price/stock writes are destructive and hard to revert" (SKILL.md:27).
- Changing `math::max(price)` (Approach 3) would affect the listing, `low_stock` filter,
  `resumen`/`valor_venta` aggregates and the PDF inventory report.
- Prior change interaction: `openspec/changes/archive/2026-08-26-product-base-price-profit-fields`
  introduced `basePrice`/`profitPercentage` and the cost-margin derived pricing used by
  `StockFeaturesForm` and `TabCreateProduct`; this fix sits directly on top of it.
- Active change interaction: `openspec/changes/excel-bulk-import-pharmacy-inventory` explicitly lists
  "Changing `stock +=` to `stock =` in backend `increase_inventory`" and "Fixing `aux_to_product`
  dropping `minimum`/`discount`" as **out of scope** (proposal.md:14-19). This change must avoid
  duplicating that scope; it may overlap only on the `stock > 0` gating semantics.
- `Price` meaning: the persisted `price` is the final price WITH VAT (`taxBreakdown`,
  `lib/pricing.ts:29-38`); the form input is a cost (USD). A "1100 Bs" request must be interpreted
  through the currency store (`useFormatCurrency.ts:23-30`), which is a UX decision, not a storage bug.

---

## 9. Open questions

1. **Which screen did the operator use?** "Producto creado" matches `TabCreateProduct.tsx:322`;
   "Producto Agregado" matches `StockFeaturesForm.tsx:534`. This decides whether root cause A or B/C
   is the primary one. Needs confirmation (e.g. a screenshot or a screen recording).
2. **Does the water jug have more than one `pharmacy_inventory` row (lot rows)?** Confirms whether
   root cause C applies and therefore whether the change must be cross-repo.
3. **Is a backend change authorized for this change?** `allowedEditRoots` is currently frontend-only.
   If C is in scope, it must be extended to `/home/enzo/medizin/Backend-administrativo`, or the
   acceptable fix is a new dedicated per-pharmacy price-set endpoint.
4. **Should a price edit propagate to all lot rows, or only the SIN LOTE bucket?** This is a product
   decision with data-history implications (existing lots carrying an older price).
5. **Should `price = 0` become settable?** Today it is impossible through the endpoint by design.

---

## 10. Ready for Proposal

**No** — three blockers: (1) confirm the exact screen/flow the operator used, (2) confirm whether
the affected product has lot rows (decides frontend-only vs cross-repo), (3) decide whether a
backend change is authorized (and, if so, extend `allowedEditRoots`). After those, proceed to
`sdd-propose`.
