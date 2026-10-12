# Delta for Inventory Lot Tracking

## MODIFIED Requirements

### Requirement: StockFeaturesForm Captures Lot on Add-Stock
The system MUST render an optional lot input in `StockFeaturesForm` and MUST forward a trimmed `lote` only when the stock delta is greater than zero. When a save fires the increase with a zero stock delta to persist price fields, the item MUST omit `lote`, so a price edit writes only the no-lot scope and never attaches a lot to a non-stock write (`modules/products/store/products.store.ts:337`).
(Previously: the increase only fired for a positive stock delta, so a lot and a stock delta always travelled together.)

#### Scenario: User adds stock with lot
- GIVEN the form shows the Lote input and the user enters a lot plus a positive quantity
- WHEN the user saves
- THEN `saveMedicine`'s increase item includes the trimmed lot alongside the delta

#### Scenario: User adds stock leaving lot blank
- GIVEN the Lote input is empty
- WHEN the user saves a positive quantity
- THEN the increase item omits the lot (SIN LOTE) and the save succeeds

#### Scenario: Price-only edit carrying a lot value
- GIVEN the user changes a price field with a zero stock delta and the Lote input has a value
- WHEN the user saves
- THEN the increase fires for the price but the item omits `lote`

#### Scenario: Lot-only edit (zero quantity)
- GIVEN the user changes the lot but leaves quantity at zero and no price/minimum/discount changed
- WHEN the user saves
- THEN no increase fires and no lot is sent (lot belongs to the stock delta, not an idempotent attribute)

## ADDED Requirements

### Requirement: No-Lote Writes Do Not Fabricate Lot Labels
The system MUST NOT create a new lot-labeled inventory row, nor assign a lot label, as a side effect of a no-lote price save. Any price change a no-lote save makes to existing rows MUST NOT create, rename, or re-label lot rows.

#### Scenario: No new lot row
- GIVEN a product has one or more existing lot rows
- WHEN a no-lote price is saved
- THEN no new lot-labeled row is created

#### Scenario: Existing lots keep their labels
- GIVEN a product has lot rows "L-2026-01" and "L-2026-02"
- WHEN a no-lote price is saved
- THEN both labels remain unchanged and no lot label is reassigned
