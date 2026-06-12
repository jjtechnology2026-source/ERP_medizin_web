/**
 * Sistema de Mocks Centralizado para Medizin
 * Permite probar las interfaces sin conexión al backend.
 */

export const MOCK_DATA: Record<string, any> = {
  "/admin/Orders/SearchOrders": [
    {
      id: "ord_1",
      idGroup: "group_1",
      pharmacy: "Farmacia Central",
      totalreal: 1540.5,
      date: new Date().toISOString(),
      status: "COMPLETADA",
      rate: 36.5,
      medications: [
        { name: "Ibuprofeno", category: "Analgesicos", price: 5, quantity: 2 },
        { name: "Amoxicilina", category: "Antibioticos", price: 12, quantity: 1 },
      ],
    },
  ],
  "/admin/Orders/Marketplace": [
    { id: "01KKSZ7C", customer: "Jesús Márquez", address: "Farmatodo, Calle Mariño, ...", date: "2026-03-15", type: "Delivery", status: "Pendiente" },
    { id: "01KKSZW0", customer: "Jesús Márquez", address: "Farmatodo, Calle Mariño, ...", date: "2026-03-15", type: "Delivery", status: "Pendiente" },
    {
      id: "01KKT2V4",
      customer: "Jesús Márquez",
      address: "Parcelamiento El Peñonal, ...",
      date: "2026-03-15",
      type: "Delivery",
      status: "Pendiente",
    },
    {
      id: "01KKT2XR",
      customer: "Jesús Márquez",
      address: "Parcelamiento El Peñonal, ...",
      date: "2026-03-15",
      type: "Delivery",
      status: "Pendiente",
    },
  ],
  "/admin/Inventory/Stock": [
    {
      name: "Azatioprina",
      category: "medicamentos",
      price: 0.01,
      quantity: 992.0,
      description: "Inmunosupresor utilizado para el tra...",
      image: "https://via.placeholder.com/40",
    },
    {
      name: "Atorvastatina",
      category: "medicamentos",
      price: 1.2,
      quantity: 50.0,
      description: "Tratamiento para el colesterol...",
      image: "https://via.placeholder.com/40",
    },
  ],
  "/admin/Orders/SearchOrdersPharmacy": [
    {
      name_pharmacy: "Farmacia Central",
      total_orders: 12500.5,
      categories: [
        { category: "Analgesicos", total: 4500, count: 120 },
        { category: "Antibioticos", total: 8000.5, count: 85 },
      ],
    },
  ],
  "/admin/Orders/reportagent": [{ agent_name: "Vendedor Alpha", total_sales: 5400, order_count: 45, commission: 270 }],
  mock_profile: {
    id: "user_test",
    name: "Administrador de Pruebas",
    email: "test@medizin.com",
    role: "ADMIN",
    id_group: "group_1",
    name_group: "Grupo Medizin Demo",
    permits: ["all"],
    image: "https://ui-avatars.com/api/?name=Admin+Test&background=005eff&color=fff",
  },
};

export const getMockData = (endpoint: string) => {
  return MOCK_DATA[endpoint] || null;
};
