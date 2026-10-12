/**
 * Runtime stand-in for `modules/products/types/products.types`.
 *
 * The real module only exports types, which Node's type stripping erases. The
 * store imports `Medication` and `StockFilter` as value bindings (they are used
 * only in type positions), so this fixture provides those names at runtime to
 * satisfy ESM linking.
 */
export const Medication = undefined;
export const StockFilter = undefined;
