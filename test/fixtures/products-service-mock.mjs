/**
 * Test fixture replacing `modules/products/api/products.service`.
 *
 * Each method is a mutable stub. Tests overwrite `productsService.<method>` and
 * reset it in `beforeEach`; the store imports the same module instance, so the
 * overrides are observed by the real store code.
 */
export const productsService = {
  getCursorInventory: async () => {
    throw new Error("getCursorInventory stub not configured");
  },
  createProduct: async () => {
    throw new Error("createProduct stub not configured");
  },
  increaseInventory: async () => {
    throw new Error("increaseInventory stub not configured");
  },
  getCatalog: async () => ({ medications: [], next_cursor: null }),
  deleteProduct: async () => {},
  updateName: async () => {},
};

/** Restore every stub to a rejecting/neutral default. Call in beforeEach. */
export function resetProductsServiceMock() {
  productsService.getCursorInventory = async () => {
    throw new Error("getCursorInventory stub not configured");
  };
  productsService.createProduct = async () => {
    throw new Error("createProduct stub not configured");
  };
  productsService.increaseInventory = async () => {
    throw new Error("increaseInventory stub not configured");
  };
  productsService.getCatalog = async () => ({ medications: [], next_cursor: null });
  productsService.deleteProduct = async () => {};
  productsService.updateName = async () => {};
}
