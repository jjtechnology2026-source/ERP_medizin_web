# Exploration: `product-base-price-profit-fields`

> Change: add `precio_base` (base price) and `porcentaje_ganancia` (profit %) to the
> product model AND to every place inventory is inserted/created.
> Artifact store: hybrid (Engram + openspec). Language: English.

## Repo topology (IMPORTANT)

This change spans **two separate git repositories**:

- **Frontend repo** (this SDD project): `/home/enzo/medizin/ERP_medizin_web` — Next.js 16 App Router, `modules/products/`.
- **Backend repo** (sibling, NOT under this repo): `/home/enzo/medizin/Backend-administrativo` — Rust + SurrealDB.

CodeGraph indexes both; frontend paths appear under `ERP_medizin_web/...`, backend paths under `Backend-administrativo/...`. Any implementation must open PRs in **both** repos.

---

## 1. Product database / model definition (backend)

File: `Backend-administrativo/src/shape/src/models/model_medications.rs`

- **`ModelMedications`** — line 82. The catalog record. Relevant fields:
  - `price: f64` (line 93)
  - `discount: Option<f64>` (line 95)
  - `quantity: Option<i64>` (line 97)
  - `stock: i64` (line 99)
  - `vat: i64` (line 104)
  - `minimum: i64` (line 107)
  - (plus `brand, activeIngredient, dosage, tablets, barCode, name, image, category, subcategory, description, controlled, antibiotic, timestamp`)
- **`ModelMedicationsaux`** — line 121. The input DTO for `/Medications/Create`. Field set mirrors `ModelMedications` (camelCase English): `price` (l.132), `quantity` (l.134), `stock` (l.136), `vat` (l.141), `minimum` (l.144), `discount` (l.133).
- **`ModelInventory`** — line 177. The **per-pharmacy inventory record** (this is where `price`/`stock` actually live per pharmacy). Fields: `pharmacy_id: RecordId`, `medication_id: RecordId`, `price: f64` (l.186), `discount: Option<f64>` (l.189), `quantity: Option<i64>` (l.192), `stock: i64` (l.195), `vat: i64` (l.198), `minimum: i64` (l.201), `timestamp`.
- **`ModelMedicationCatalog`** — line 160. Universal catalog; deliberately has **no** price/stock.

**Naming**: every field is **English**, `camelCase` (e.g. `price`, `stock`, `minimum`, `discount`, `vat`, `quantity`). No Spanish field names exist anywhere in the model layer. SurrealDB keys are serialized from these Rust field names (serde default + `SurrealValue`), i.e. stored as `price`, `stock`, etc.

---

## 2. The "rp" UI for adding inventory (AMBIGUOUS — flag)

"rp" is **not** a file, component, or route identifier in this repo. The `productos` route (`app/(secciones)/(general)/productos/page.tsx`) renders `InventoryPage` = `modules/products/index.tsx`, which switches between named views (`LIST`, `CREATE_MANUAL`, `SEARCH_CATALOG`, `ADD_STOCK`, `STOCK_FEATURES`, `STOCK_TAX`). The two manual forms that show `precio` + `stock` for adding inventory are:

- **`TabCreateProduct.tsx`** (`CreateProductPage`, view `CREATE_MANUAL`) — the manual **create-product** form.
  - `label="Precio ($)"` — line 535, bound to `formData.price`.
  - `label="Stock inicial"` — line 543, bound to `formData.stock`.
  - `label="Stock mínimo"` — line 559, bound to `formData.minimum`.
  - `label="IVA (%)"` — line 551, bound to `formData.vat`.
  - Submit (`handleSubmit`, line 260) → `createMedication(...)` → `POST /Medications/Create`.
  - This is the most likely match for "rp" (manual add of a product with precio+stock).
- **`StockFeaturesForm.tsx`** (`StockFeaturesForm`, view `STOCK_FEATURES`) — the **add/edit-stock** form (also reachable from `ADD_STOCK` → `StockAutocomplete` select).
  - `label="Precio Base (sin IVA)"` — line 190, bound to `priceWithoutVat` (NOTE: this is a *computed display* of sale price ex-VAT, NOT a stored `precio_base`).
  - `label="Agregar al stock (+)"` — line 247, bound to `quantity` (the delta added to stock).
  - `label="Stock Mínimo (Alerta)"` — line 255.
  - `label="Descuento (%)"` — line 263.
  - Submit (`handleSave`, line 68) → `saveMedicine(...)` → `createProduct` + `increaseInventory`.
- For contrast, the user already named `BulkImportDialog.tsx` separately (Excel import); it has `Precio (USD)` (l.40/128) and `Stock`/`Stock Inicial` (l.129) Excel columns.

**Flag**: confirm with the user which screen "rp" is. Both `TabCreateProduct` (create) and `StockFeaturesForm` (add stock) are insertion points and BOTH must gain the two new fields regardless. If "rp" is a third, yet-unknown screen, it must be located before implementation.

---

## 3. Backend inventory insertion endpoint(s) + DTOs

### Endpoint A — `POST /admin/Medications/Create` (catalog create)
- Handler: `create_medications` — `Backend-administrativo/src/features/medications/src/infrastructure/controllers/create.rs:19`.
- Input DTO: `web::Json<Vec<ModelMedicationsaux>>` (line 21). Price/stock are read from `ModelMedicationsaux` (camelCase English: `price` l.132, `stock` l.136, `minimum` l.144, `discount` l.133, `vat` l.141).
- Flow: `use_case.create_Medication.execute(...)`. Inventory persistence for brand-new products is driven from the **frontend** via MQTT `MedicationProto` (see Endpoint B wire struct), not inside this handler.

### Endpoint B — `POST /admin/MedicationsAgent/increase` (inventory increase)
- Handler: `increase_inventory` — `Backend-administrativo/src/features/medications_agent/src/infrastructure/controllers/increase_inventory.rs:67`.
- Input DTO: `IncreaseInventoryRequest` — `Backend-administrativo/src/features/medications_agent/src/adapters/dto.rs:8`:
  - `pharmacy_id: String` (l.10)
  - `medications: Vec<IncreaseMedicationItem>` (l.12)
- `IncreaseMedicationItem` — dto.rs:19 (snake_case English):
  - `bar_code: String` (l.21)
  - `stock: f64` (l.23)
  - `price: f64` (l.25)
  - `discount: Option<f64>` (l.27)
  - `minimum: f64` (l.29)
- Handler maps each item → `MedicationProto { bar_code, quantity=stock, price, discount, minimum }` (increase_inventory.rs:82-90) → `DtoUpdateMedications` → `increase_Medication.execute` → MQTT `pharmacy/{id}/insert_inventory`.

### Canonical wire struct — `MedicationProto` (proto3)
- File: `Backend-administrativo/src/features/medications_agent/src/adapters/dto.proto:15`.
- Fields (snake_case English): `brand, active_ingredient, dosage, tablets, bar_code, name, image, category, subcategory, price:double, quantity:double, stock:double, description, controlled, vat:double, antibiotic, minimum:double, discount (optional)`.
- This is the **single inventory-insert wire format** used by BOTH the `increase` handler AND the frontend MQTT publish in `useCreateProduct.ts` (medProto). If base price / margin must reach the inventory table, **`MedicationProto` must gain fields** and the handler mapping (increase_inventory.rs:82) must set them.

### Endpoint C — `POST /admin/MedicationsAgent/import-stock` and `/import-prices` (backend Excel bulk)
- Handler: `import_pharmacy_stock_from_excel` / `_legacy` — `Backend-administrativo/src/features/medications_agent/src/infrastructure/controllers/import_prices.rs:33` and `:51`.
- Multipart Excel upload → `ApplyPharmacyMedicationStockUseCase`. Price/stock columns are parsed **inside that use case** (no JSON DTO). This is a third inventory-insert surface; its Excel column mapping must also read the two new fields.

### Adjacent mutations (not pure insert, note for completeness)
- `POST /admin/Medications/Update` (`update.rs`) — catalog update; base price/margin likely also need to be settable here.
- `POST /admin/MedicationsAgent/decrease` (`decrease_inventory.rs`) — decreases stock; not an insert.

---

## 4. Frontend service + types for inventory insert

File: `ERP_medizin_web/modules/products/api/products.service.ts`

- **`createProduct(medication: Partial<Medication>)`** — lines 72-97. Payload to `/Medications/Create` includes `price` (l.83), `quantity`/`stock` (l.84-85), `minimum` (l.90), `discount`, `vat`. Input type = `Partial<Medication>`.
- **`increaseInventory(pharmacyId, medications)`** — lines 151-157. Explicit input type (line 152):
  `{ bar_code: string; stock: number; price: number; minimum: number; discount?: number }[]`.
  Posts `{ pharmacy_id, medications }` to `/admin/MedicationsAgent/increase`.
- **`bulkImportWithProgress(products: BulkProductRow[], ...)`** — lines 110-145. Builds the product from `BulkProductRow` (`price` l.133, `stock` l.134, `vat` l.135, `minimum` l.136) → `createProduct`.

### ALL insertion points that must thread the two new fields

**Frontend (UI → service):**
1. `TabCreateProduct.tsx` (CREATE_MANUAL) → `useCreateProduct.createMedication` → `POST /Medications/Create` + MQTT `MedicationProto` (`inventoryInsert`) (`useCreateProduct.ts:69`, `:114`).
2. `StockFeaturesForm.tsx` (STOCK_FEATURES) → `products.store.saveMedicine` → `createProduct` + `increaseInventory` (`products.store.ts:210-278`).
3. `BulkImportDialog.tsx` → `createProduct` + `increaseInventory` (`BulkImportDialog.tsx:192`).

**Backend (HTTP / async):**
4. `POST /admin/MedicationsAgent/increase` (`IncreaseInventoryRequest`) — direct HTTP insert (other clients too).
5. `POST /admin/MedicationsAgent/import-stock` / `import-prices` (Excel, `ApplyPharmacyMedicationStockUseCase`).
6. `POST /admin/Medications/Create` (`Vec<ModelMedicationsaux>`) — catalog create; also seeds inventory via MQTT from the frontend.

Every one of 1-6 must carry `basePrice`/`profitPercentage` (or the Spanish names if chosen) end-to-end.

---

## 5. Field naming convention (KEY FINDING)

| Layer | Convention | Evidence |
|-------|-----------|----------|
| Backend shape models (`ModelMedications`, `ModelInventory`, `ModelMedicationsaux`) | **English, camelCase** | `price`, `stock`, `minimum`, `discount`, `vat`, `quantity` |
| Backend `medications_agent` HTTP DTO (`IncreaseInventoryRequest`) | **English, snake_case** | `pharmacy_id`, `bar_code`, `stock`, `price`, `discount`, `minimum` |
| Backend proto (`MedicationProto`) | **English, snake_case** | `active_ingredient`, `bar_code`, `id_agent`, `id_pharmacy`, `price`, `stock`, `quantity`, `minimum`, `discount` |
| Frontend types/service (`Medication`, `productsService`) | **English, camelCase** | `price`, `stock`, `quantity`, `minimum`, `discount`, `vat`, `barCode`, `activeIngredient` |
| SurrealDB stored keys | **English, camelCase** (serde default) | derived from Rust field names |

**Conclusion**: the existing convention is **English everywhere**. The user-requested names `precio_base` / `porcentaje_ganancia` are **Spanish** and would break the convention.

**Recommendation** (follow convention):
- Catalog/inventory Rust models + frontend `Medication`/`BulkProductRow`: `basePrice: f64` + `profitPercentage: f64` (camelCase English). [If semantic is "margin", prefer `marginPercentage`.]
- `medications_agent` HTTP DTO + `MedicationProto`: `base_price` + `profit_percentage` (snake_case English, matching those layers).
- Or, to stay uniform across layers, use `base_price`/`profit_percentage` everywhere (but that diverges from the camelCase shape models — needs a decision).

**Flag / risk**: if the user truly wants literal `precio_base`/`porcentaje_ganancia`, that diverges from 100% of existing fields and must be applied consistently across (a) SurrealDB `ModelMedications`/`ModelInventory`/`ModelMedicationsaux`, (b) `IncreaseInventoryRequest`/`IncreaseMedicationItem`, (c) `MedicationProto`, (d) frontend `Medication`/`BulkProductRow`/service — and it will be inconsistent within the codebase. **Decision required before proposal.**

**Semantic ambiguity**: `StockFeaturesForm` already shows a label "Precio Base (sin IVA)" (l.190) — but that is a *computed* sale-price-ex-VAT display, NOT a stored base-cost field. The new `precio_base` (with `porcentaje_ganancia`) reads like **cost price + profit margin** (sale = base × (1 + margin)). Confirm this is the intended meaning and that it is distinct from the existing ex-VAT display, to avoid two "precio base" concepts.

---

## 6. State / hooks involved

- **Zustand store** `ERP_medizin_web/modules/products/store/products.store.ts`:
  - `saveMedicine(medicine)` — line 210. Central add/edit-stock action → calls `createProduct` (l.216/225) **and** `increaseInventory` (l.264). Must pass the two new fields in both calls.
  - `addToInventory(medications)` — line 163. Local cache merge only (not a backend insert) but must carry the new fields to keep the UI consistent.
  - State shape uses `Medication` (from `products.types.ts`).
- **Hook** `ERP_medizin_web/modules/products/hook/useCreateProduct.ts`:
  - `useCreateMedication` / `createMedication` — posts `/Medications/Create` (l.69) and builds MQTT `MedicationProto` (l.85-104) for `inventoryInsert` (l.114). The `MedicationData` interface (l.8-28) defines the create payload and must gain the new fields; the medProto object (l.85) must set them on `MedicationProto`.
- **React-query hooks**: `ERP_medizin_web/modules/products/hooks/useProductSearch.ts` exists, but `createProduct`/`increaseInventory` are called **directly via `productsService`** (no react-query wrapper). So only the Zustand store + `useCreateProduct` hook + the service + the types need changes (no extra query hook).
- **MQTT provider** `ERP_medizin_web/modules/products/providers/MqttInventoryProvider.tsx`: consumes inventory updates for display only; may need to surface the new fields in the UI but is not an insertion point.

---

## Approaches (how to thread the fields)

1. **Mirror existing convention (recommended)** — add `basePrice`/`profitPercentage` to catalog+inventory models and frontend; `base_price`/`profit_percentage` to the agent HTTP DTO + `MedicationProto`. Map at each boundary.
   - Pros: consistent with all existing fields; lowest cognitive load.
   - Cons: two spellings (camel vs snake) across layers — already the status quo, so no new inconsistency.
   - Effort: Medium (touches 2 repos, ~8 files).
2. **Literal Spanish names** — add `precio_base`/`porcentaje_ganancia` everywhere.
   - Pros: matches the user's wording.
   - Cons: breaks the English convention present in 100% of fields; inconsistent within the codebase; risk of confusion with the existing "Precio Base (sin IVA)" display.
   - Effort: Medium, but higher review/risk cost.

### Recommendation
Adopt Approach 1 (English). Confirm the exact spelling (`basePrice`/`profitPercentage` vs `marginPercentage`) and confirm the user does NOT require literal Spanish. Also confirm whether the fields belong on the **catalog only**, the **per-pharmacy inventory only** (`ModelInventory`, since `price` is per-inventory), or **both** — recommend **both**, mirroring how `price` already lives on `ModelInventory`.

---

## Risks
- **Naming mismatch**: user's Spanish field names conflict with the English convention — decision required before proposal.
- **"rp" unresolved**: which exact screen the user means is ambiguous; both manual forms are insertion points regardless.
- **Cross-repo change**: backend + frontend are separate repos; implementation needs 2 PRs and coordinated field names.
- **Proto + 3rd insert endpoint**: `MedicationProto` (dto.proto) and the backend Excel `import-stock`/`import-prices` use case are easy to miss; both insert inventory and must carry the fields.
- **Semantic overlap**: "Precio Base" already used as a computed display label — must distinguish stored base-cost from ex-VAT sale price.
- **Inventory vs catalog placement**: `price` is per-pharmacy (`ModelInventory`); base price/margin likely should be too.

---

## Ready for Proposal
**No** — two clarifications needed first: (1) confirm field naming (English `basePrice`/`profitPercentage` vs literal Spanish), (2) confirm "rp" maps to `TabCreateProduct` and/or `StockFeaturesForm`. After confirmation, proceed to `sdd-propose`.
