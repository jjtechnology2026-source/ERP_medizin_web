/**
 * Test fixture replacing `modules/core/mqtt/advanced-service`.
 *
 * `saveMedicine` does not publish MQTT, but importing the real module pulls in
 * the `mqtt` client. This stub keeps the store import side-effect free.
 */
export const mqttServer = {
  publish: async () => {},
};
