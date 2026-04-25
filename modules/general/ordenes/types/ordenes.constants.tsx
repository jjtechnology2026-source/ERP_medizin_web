import { FilterConfig } from "@/components/shared/dataTable/FilterGeneral";

export interface Medication {
  brand: string;
  activeIngredient: string;
  dosage: string;
  tablets: string;
  barCode: string;
  name: string;
  image: string;
  category: string;
  subcategory: string;
  price: number;
  quantity: number;
  stock: number;
  description: string;
  controlled: boolean;
  vat: number;
  antibiotic: boolean;
  minimum: number;
}

export interface Payment {
  runtimeType: string;
  change: number;
  amount: number;
}

export interface Client {
  id: string;
  documento: string;
  name: string;
  email: string;
  direccion: string;
  phone: string;
}

export interface FacturacionResp {
  numerointerno: string;
  numerocontrol: string;
  trackingid: string;
  urlpdf: string;
  fecha: string;
}

export interface Facturacion {
  success: boolean;
  resp: FacturacionResp | null;
  error: any;
}

export interface Ordenes {
  date: string;
  id: string;
  nameGroup: string;
  idAgent: string;
  nameAgent: string;
  idPharmacy: string;
  idGroup: string;
  medications: Medication[];
  totalreal: number;
  totalsystem: number;
  client: Client;
  payments: Payment[];
  rate: number;
  gender: string;
  saleStatus: string;
  isControlled: boolean;
  saleType: string;
  address: string;
  pharmacy: string;
  delivery: string | null;
  numeroControlInterno: string | null;
  facturacion: Facturacion | null;
  observation: string | null;
}

export const COLUMNS = [
  {
    header: "ID Orden",
    key: "id",
    render: (item: Ordenes) => (
      <span className="font-mono text-[10px] text-gray-500">{item.id}</span>
    ),
  },
  {
    header: "Número",
    key: "numerointerno",
    render: (item: Ordenes) => item.facturacion?.resp?.numerointerno || "N/A",
  },
  {
    header: "Cliente",
    key: "client",
    render: (item: Ordenes) => (
      <div className="flex flex-col">
        <span className="font-bold text-gray-900">{item.client.name}</span>
        <span className="text-[10px] text-gray-400 font-medium">
          {item.client.documento}
        </span>
      </div>
    ),
  },
  {
    header: "Género",
    key: "gender",
    render: (item: Ordenes) =>
      item.gender === "Male" ? "Masculino" : "Femenino",
  },
  {
    header: "Fecha/Hora",
    key: "date",
    render: (item: Ordenes) => new Date(item.date).toLocaleString(),
  },
  {
    header: "Tipo",
    key: "saleType",
    render: (item: Ordenes) => (
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          item.saleType === "Local"
            ? "bg-green-100 text-green-700"
            : "bg-blue-100 text-blue-700"
        }`}
      >
        {item.saleType.toUpperCase()}
      </span>
    ),
  },
  {
    header: "Farmacia",
    key: "pharmacy",
    render: (item: Ordenes) => (
      <div className="flex flex-col">
        <span className="text-gray-800 leading-none font-medium">
          {item.pharmacy}
        </span>
        <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-tighter">
          {item.nameGroup}
        </span>
      </div>
    ),
  },
  {
    header: "Total",
    key: "totalreal",
    render: (item: Ordenes) => (
      <div className="flex flex-col text-right">
        <span className="font-bold text-blue-600 text-lg leading-none">
          ${item.totalreal.toFixed(2)} USD
        </span>
      </div>
    ),
  },
];

export const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "pharmacy",
    label: "Farmacias",
    type: "select",
  },
  {
    key: "saleType",
    label: "Tipo Venta",
    type: "select",
    options: ["Local", "Delivery", "Pickup"],
  },
  {
    key: "date",
    label: "Fecha",
    type: "date-range",
  },
];
