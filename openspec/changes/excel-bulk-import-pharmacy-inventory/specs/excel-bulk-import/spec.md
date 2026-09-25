# Excel Bulk Import Specification

## Purpose

Bulk Excel import of medication products into catalog and pharmacy inventory via the `/Medications/Create` and `/admin/MedicationsAgent/increase` endpoints.

## Requirements

### Requirement: Excel Column Parsing via Fuzzy Matching

The system MUST parse controlled and antibiotic columns using the same `getCol()` fuzzy matcher as all other columns. It MUST NOT access column names directly.

Fuzzy aliases:

| Column | Aliases |
|--------|---------|
| controlled | `Controlado (SI/NO)`, `controlled`, `CONTROLADO` |
| antibiotic | `Antibiótico (SI/NO)`, `antibiotic`, `ANTIBIOTICO` |

Value interpretation: any trimmed uppercase value equal to `"SI"` is `true`; everything else (including empty string) is `false`.

#### Scenario: Spanish column headers match

- GIVEN an Excel with header `"Controlado (SI/NO)"` containing `"SI"`
- WHEN the file is parsed
- THEN `product.controlled` is `true`

#### Scenario: English column headers match

- GIVEN an Excel with header `"antibiotic"` containing `"NO"`
- WHEN the file is parsed
- THEN `product.antibiotic` is `false`

#### Scenario: Empty or missing column

- GIVEN an Excel without any controlled/antibiotic column
- WHEN the file is parsed
- THEN `product.controlled` and `product.antibiotic` are both `false`

---

### Requirement: Pharmacy Inventory Creation After Catalog Import

After `bulkImportWithProgress` completes, the system MUST call `productsService.increaseInventory()` for every imported product that has `stock > 0`. The call MUST use the product's `barCode`, `stock`, `price`, and `minimum` fields.

#### Scenario: Products with stock create inventory

- GIVEN 3 products imported, 2 with `stock > 0`
- WHEN bulk import completes and `pharmacyId` is present
- THEN `increaseInventory()` is called once with those 2 products
- AND the result displays inventory-updated count

#### Scenario: Products with no stock skip inventory

- GIVEN a product with `stock = 0` or `stock` undefined
- WHEN bulk import completes
- THEN that product is excluded from the `increaseInventory()` call

---

### Requirement: Pharmacy ID Requirement

`BulkImportDialog` MUST accept an optional `pharmacyId?: string` prop. If `pharmacyId` is undefined, the system MUST skip inventory insertion and SHALL display a warning to the user.

#### Scenario: pharmacyId provided

- GIVEN `BulkImportDialog` receives a valid `pharmacyId`
- WHEN bulk import completes
- THEN inventory is inserted for products with `stock > 0`

#### Scenario: pharmacyId undefined

- GIVEN `BulkImportDialog` receives `pharmacyId = undefined`
- WHEN bulk import completes
- THEN no `increaseInventory()` call is made
- AND a warning is shown to the user

---

### Requirement: Import Result Display

After import completes, the system MUST display: number of products created in catalog, number of products with inventory updated, and any errors. The `BulkImportDialogProps` result type MUST extend to include `inventoryUpdated: number`.

#### Scenario: Successful import with inventory

- GIVEN 5 products imported, 4 with inventory updates
- WHEN import completes successfully
- THEN result shows `"5 productos creados, 4 con inventario actualizado"`

#### Scenario: Partial failure

- GIVEN 5 products, 2 fail catalog creation, 3 succeed with inventory
- WHEN import completes
- THEN result shows success count, inventory count, and error list

#### Scenario: pharmacyId missing warning

- GIVEN import succeeds but `pharmacyId` was undefined
- WHEN import completes
- THEN result shows `"X productos creados (inventario no actualizado: falta farmacia)"`

---

### Requirement: Existing Product Handling

The `increaseInventory` backend endpoint already resolves barCode → product_id and INSERTs or UPDATEs inventory rows. The frontend MUST NOT duplicate catalog products. The system SHALL rely on the backend's barCode deduplication in `/Medications/Create` and the INSERT/UPDATE logic in `/admin/MedicationsAgent/increase`.

#### Scenario: Re-importing existing products

- GIVEN products with barCodes already in the catalog
- WHEN the same Excel is imported again
- THEN catalog products are updated (not duplicated)
- AND inventory rows are updated (not duplicated) via `increaseInventory`
