# Design: Medicine Lot Tracking — Stock Intake (Frontend)

## Technical Approach

Thread an optional text-only `lote` through the three frontend stock-intake paths that call `increaseInventory` (manual add-stock, initial stock at product creation, bulk Excel import). Lot is a **single-word key** (camel == snake, no mapping), optional `string | null`, trimmed at the source, omitted when blank. The catalog `createProduct` payload, the inventory read model, and the entire sale flow are untouched; the backend owns FIFO derivation and lot stamping on persisted order lines.

## Architecture Decisions

### Decision: Lot is optional in the payload (blank ⇒ SIN LOTE), not required when stock > 0
**Choice**: `lote?: string | null` on each increase item; blank/whitespace ⇒ field omitted (encoded null). Forms show an optional input, never block save.
**Alternatives considered**: Required-when-stock>0 (validation error if missing).
**Rationale**: Mirrors the precedent nullable pattern — `createProduct` encodes `basePrice`/`profitPercentage` as null when undefined (`products.service.ts:92-93`) and `increaseInventory` items already accept `discount?/base_price?/profit_percentage?` (`products.service.ts:156`). Requiring the field would break legacy bulk files without the column, zero-stock catalog creates, and every existing Excel flow — contradicting fixed decision (4) (legacy ⇒ SIN LOTE). Placeholder/label follow the Spanish UI copy of the surrounding inputs (project convention): label `Lote (opcional)`, placeholder `Ej: L-2026-001`. Business rule: free text, no expiry semantics, trimmed; empty-after-trim == absent (spec R8).

### Decision: No lot exposure in the inventory read model
**Choice**: Do not add `lote` to the cursor response mapping, `Medication` read usage, or any inventory UI.
**Alternatives considered**: Returning per-lot rows or a `lote` field on cursor medications.
**Rationale**: The frontend shows stock aggregated per `barCode` — `fetchInventory` merges flat rows by `barCode` (`products.store.ts:129-144`), persisted zustand `products-storage` keeps flat `Medication[]` (`products.store.ts:367-372`), and display sums totals (`StockTaxBreakdown.tsx:123-130`). `cleanImg` spreads unknown API fields through (`products.service.ts:4-13`), so if the backend later returns a lot it degrades harmlessly. No read-path change needed (spec R7).

### Decision: Field name is the single word `lote` everywhere in TS payloads
**Choice**: `lote` in interfaces and wire payloads; `Medication.lote?`, `BulkProductRow.lote?`, `MedicationData.lote?`.
**Alternatives considered**: `batch`, `lotCode`, `lote` + snake mapping.
**Rationale**: Existing increase items mix conventions only because backend field names force it (`bar_code` snake at `products.store.ts:265` vs `discount` camel at `:269`). `lote` is one word — identical under both, zero mapping, zero collision risk (products.types.ts and orders/types/orders.ts have no such key today).

### Decision: Excel Lote column is optional and degrades silently
**Choice**: Template gains an optional `Lote` column after `Stock`; parse maps non-empty cells; absent column ⇒ `undefined` ⇒ omitted on increase.
**Alternatives considered**: Required column, or omitting it from the template entirely.
**Rationale**: `getCol` returns `""` for a missing column (`BulkImportDialog.tsx:92-109`), so the parse keeps its existing `raw ? value : undefined` shape (`:145-163`). Files from the old template import unchanged — required by spec R5 and by the in-flight Excel change that ships the current template.

### Decision: `saveMedicine` change-detection is NOT extended with lot
**Choice**: Leave the `changed` check (`products.store.ts:257-262`) comparing stock/price/min/discount only; lot rides the increase item.
**Alternatives considered**: Treating a lot-only edit as a change and firing `increaseInventory`.
**Rationale**: Lot belongs to a stock DELTA, not an idempotent attribute. A 0-quantity lot edit should no-op (spec R3 scenario 3); firing an increase with quantity 0 would corrupt stock semantics. Pre-existing quirk: when `q === existing.stock` and price/min/discount are unchanged the increase is skipped entirely (`:258-262`) — out of scope, and lot stays consistent because it only matters when the delta fires.

### Decision: Proto `MedicationProto` is NOT touched
**Choice**: No `.proto` change; fields 18/21 stay free.
**Alternatives considered**: `optional string lot = 21` for MQTT insert/update.
**Rationale**: Inventory increases are HTTP-driven — code comments state the backend no longer subscribes to `insert_inventory` over MQTT (`useCreateProduct.ts:82`, `BulkImportDialog.tsx:210`); the frontend publishes MQTT only for delete (`products.store.ts:297-303`). No in-scope message needs to carry a lot, so wire/proto stays untouched (spec R6/R7 scope).

## Data Flow

    StockFeaturesForm ── saveMedicine(med.lote) ──► products.store.ts ──┐
    TabCreateProduct ── createMedication(baseData.lote) ──► useCreateProduct ──┤
    BulkImportDialog ── row.lote (Excel "Lote") ──► bulkImportWithProgress ─────┤
                                                                                ▼
                                                   products.service.increaseInventory({ lote }) ──► POST /admin/MedicationsAgent/increase
                                                   (blank ⇒ omitted ⇒ backend "SIN LOTE")
    Catalog createProduct payload: NO lote.  Order payload / buildModelOrder / orders types: NO lote.  Cursor read: NO lote.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `modules/products/types/products.types.ts` | Modify | `Medication` + `BulkProductRow` gain `lote?: string` |
| `modules/products/api/products.service.ts` | Modify | `increaseInventory` item type (l.156) gains `lote?: string \| null` |
| `modules/products/store/products.store.ts` | Modify | `saveMedicine` increase item (l.264-272) forwards trimmed `medicine.lote` |
| `modules/products/hook/useCreateProduct.ts` | Modify | `MedicationData` (l.6-28) + initial-stock increase item (l.87-98) |
| `modules/products/components/StockFeaturesForm.tsx` | Modify | Lote state + optional input (grid l.270-306) + medicine object (l.91-100) |
| `modules/products/components/TabCreateProduct.tsx` | Modify | Lote input in Precio-y-Stock grid (l.544-588) + payload (l.272-283) |
| `modules/products/components/BulkImportDialog.tsx` | Modify | Template header (l.30-47), parse (l.145-163), post-link increase (l.212-223) |

## Interfaces / Contracts

```ts
// products.service.ts — increase item (was l.156)
type IncreaseItem = { bar_code: string; stock: number; price: number; minimum: number;
  discount?: number | null; base_price?: number | null; profit_percentage?: number | null;
  lote?: string | null };

// products.types.ts / useCreateProduct.ts — carriers
interface Medication { /* ...existing */ lote?: string }
interface BulkProductRow { /* ...existing */ lote?: string }
interface MedicationData { /* ...existing */ lote?: string }
```

Encode rule at all three call sites: `...(lote?.trim() ? { lote: lote.trim() } : {})`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Type-check | All touched files compile with/without `lote` | `pnpm build` (Next 16 type-check) |
| Unit (manual) | Payload omit-on-blank at each call site | Playwright/devtools: submit blank vs filled in both forms |
| Integration (manual) | Excel template round-trip with and without Lote column | Parse a legacy file (no column) + a file with column in `BulkImportDialog` |
| Regression | Catalog create + checkout payload byte-identical | Network tab compare before/after |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration. Optional field, backend degrades absent → SIN LOTE. Frontend PR is independent and revertible. Sequence apply after `excel-bulk-import-pharmacy-inventory` merges (same `BulkImportDialog.tsx` regions).

## Open Questions

- None blocking. (Backend `IncreaseMedicationItem` field name `lote` is a cross-repo contract already agreed; unknown fields are ignored by the current server until that PR lands.)
