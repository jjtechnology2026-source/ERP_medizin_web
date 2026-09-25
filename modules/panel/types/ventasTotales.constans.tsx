import React from "react";

export interface CategoryStat {
  category: string;
  count: number;
  total: number;
}

export interface VentasTotales {
  idGroup?: string;
  name_pharmacy: string;
  total_orders: number;
  categories: CategoryStat[];
}

export const COLUMNS = [
  { header: "Nombre de la Farmacia", key: "name_pharmacy" },
  {
    header: "Por Categorías",
    key: "categories",
    render: (item: VentasTotales) => (
      <span className="text-gray-600 font-medium">
        {item.categories?.length || 0} Categorías
      </span>
    ),
  },
  {
    header: "Ventas Totales",
    key: "total_orders",
    render: (item: VentasTotales) => (
      <span className="font-bold text-blue-600">
        BS {item.total_orders.toFixed(2)}
      </span>
    ),
  },
];

export const FILTER_CONFIG = [
  { key: "date", label: "Rango de Fecha", type: "date-range" as const },
  {
    key: "type_sale",
    label: "Tipo de venta",
    type: "select" as const,
    options: [
      { label: "Todas", value: "" },
      { label: "Local", value: "retail" },
      { label: "Delivery", value: "delivery" },
      { label: "Pickup", value: "pickup" },
    ],
  },
];