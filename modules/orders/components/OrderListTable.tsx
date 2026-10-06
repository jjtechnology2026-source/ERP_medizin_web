"use client";
import { useState, useMemo, useEffect } from "react";
import { 
  HiOutlineEye, HiOutlineRefresh, HiX, HiOutlineExternalLink 
} from "react-icons/hi";
import { Order } from "../types/orders";
import OrderDetailModal from "./OrderDetailModal";
import OrderFilters from "./OrderFilters";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

/** Shape carrying the order status: the backend may send `saleStatus` or (legacy) `sale_status`. */
type StatusCarrier = { saleStatus?: string | null; sale_status?: string | null };

const statusKey = (order: StatusCarrier | null | undefined): string =>
  String(order?.saleStatus ?? order?.sale_status ?? "").trim().toLowerCase();

const statusLabel = (key: string): string => {
  switch (key) {
    case "completed":
    case "completada":
    case "entregada":
      return "Completado";
    case "cancelled":
    case "cancelada":
    case "canceled":
      return "Cancelado";
    case "pending":
    case "pendiente":
      return "Pendiente";
    case "paid":
      return "Pagado";
    case "pipelinefailed":
      return "Falló el proceso";
    default:
      return key || "Pendiente";
  }
};

const statusClass = (key: string): string => {
  switch (key) {
    case "completed":
    case "completada":
    case "entregada":
      return "bg-emerald-100 text-emerald-600";
    case "cancelled":
    case "cancelada":
    case "canceled":
      return "bg-rose-100 text-rose-600";
    case "paid":
      return "bg-sky-100 text-sky-600";
    case "pipelinefailed":
      return "bg-red-600 text-white";
    default:
      return "bg-amber-100 text-amber-600";
  }
};

interface OrdersPageProps {
  orders: Order[];
  loading: boolean;
  filters: {
    id_group: string;
    id_pharmacy: any;
    date_start: string;
    date_end: string;
    type_sale: string;
    status: string; 
  };
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  onRefresh: () => void;
  isRefreshing?: boolean;
  total: number;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
}

// --- COMPONENTES ATÓMICOS ---

const ActionButton = ({ icon, color, onClick }: { icon: React.ReactNode, color: 'blue' | 'emerald' | 'amber', onClick?: () => void }) => {
  const styles = {
    blue: "text-[#4A69BD] bg-blue-50 border-blue-100 hover:bg-[#4A69BD] hover:text-white",
    emerald: "text-[#2ECC71] bg-emerald-50 border-emerald-100 hover:bg-[#2ECC71] hover:text-white",
    amber: "text-[#F1C40F] bg-amber-50 border-amber-100 hover:bg-[#F1C40F] hover:text-white"
  };
  return (
    <button onClick={onClick} className={`p-2 rounded-lg border transition-all duration-200 active:scale-90 ${styles[color]}`}>
      {icon}
    </button>
  );
};


// --- COMPONENTE PRINCIPAL ---

export default function OrdersPage({ orders, loading, isRefreshing, filters, setFilters, onRefresh, total, fetchNextPage, hasNextPage }: OrdersPageProps) {
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const formatOrderTotal = (total: number) => {
    if (isDollar) {
      return `$ ${total.toFixed(2)}`;
    }
    return `Bs ${(total * rate).toFixed(2)}`;
  };

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const colSpan = 8;

  // 1. Ordernar por fecha (Más recientes primero)
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.date || (a as any).fecha || Date.now()).getTime();
      const dateB = new Date(b.date || (b as any).fecha || Date.now()).getTime();
      return dateB - dateA;
    });
  }, [orders]);

  // 2. Filtrar por status localmente
  const filteredOrders = useMemo(() => {
    if (!filters.status) return sortedOrders;
    return sortedOrders.filter(order => statusKey(order) === String(filters.status).trim().toLowerCase());
  }, [sortedOrders, filters.status]);

  // 3. Pagination — reset on filter changes via key or explicit effect
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  // The loaded page window can shrink on a refetch (an intermediate cursor that no longer exists
  // ends the replay early), and the 60 s interval makes that reachable with no operator action.
  // The index is clamped at render time instead of synced by an effect: no extra render, no state
  // written from an effect, and the table can never sit past the end of the data.
  const safePage = Math.min(currentPage, totalPages);
  const currentOrders = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, safePage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.status]);

  const filterClass = "px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 flex items-center gap-2 hover:border-blue-400 transition-all min-w-[140px] outline-none shadow-sm";

  const getNoDataMessage = () => {
    const messages = [];
    if (filters.type_sale) messages.push(`tipo "${filters.type_sale}"`);
    if (filters.status) messages.push(`estado "${statusLabel(String(filters.status).trim().toLowerCase())}"`);
    if (filters.date_start || filters.date_end) messages.push('rango de fechas seleccionado');
    return messages.length > 0 ? `No hay órdenes para ${messages.join(', ')}.` : 'No hay órdenes disponibles.';
  };

  return (
    <div className="flex flex-col h-full gap-6 bg-white p-2">
      <h1 className="text-3xl font-bold text-[#4A69BD]">Ordenes</h1>

      {/* --- FILTROS --- */}
      <OrderFilters 
        filters={filters} 
        onFiltersChange={setFilters} 
        onReset={() => {
          setFilters({ date_start: "", date_end: "", type_sale: "", status: "" });
        }}
      />

      {/* --- TABLA --- */}
      <div className="flex-grow overflow-hidden border border-slate-100 rounded-2xl shadow-sm bg-white">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-hide">
          <table className="w-full text-left relative min-w-[1000px]">
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)] z-10">
              <tr>
                {["ID", "Nombres", "Dirección", "Fecha", "Tipo", "Total", "Status", "Detalles"].map((h) => (
                  <th key={h} className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={colSpan} className="text-center py-20 text-slate-400 font-medium">Cargando datos...</td></tr>
              ) : !loading && filteredOrders.length === 0 ? (
                <tr><td colSpan={colSpan} className="text-center py-20 text-slate-500 font-medium">{getNoDataMessage()}</td></tr>
              ) : currentOrders.map((order) => (
                <tr key={order.id || (order as any).idOrder} className="hover:bg-blue-50/40 transition-colors group">
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">{(order.id || (order as any).idOrder || "")?.slice(0, 8)}...</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700">{order.client?.name || (order as any).clientName || "Cliente General"}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 capitalize">{order.client?.direccion || (order as any).address || ""}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(order.date || (order as any).fecha || Date.now()).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {(() => {
                      const type = String(order.saleType || (order as any).sale_type || "").trim();
                      if (!type) return "-";
                      return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">
                    {formatOrderTotal(Number(order.totalreal !== undefined ? order.totalreal : (order as any).total_real) || 0)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-[10px] font-black rounded-md uppercase ${statusClass(statusKey(order))}`}>
                      {statusLabel(statusKey(order))}
                    </span>
                  </td>
                  <td className="px-6 py-4"><ActionButton onClick={() => setSelectedOrder(order)} icon={<HiOutlineEye size={18}/>} color="blue" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- PAGINATION --- */}
        <div className="p-4 border-t border-slate-50 flex justify-between items-center bg-white">
          <p className="text-xs font-bold text-slate-400">
            Mostrando {currentOrders.length > 0 ? (safePage - 1) * itemsPerPage + 1 : 0} - {Math.min(safePage * itemsPerPage, filteredOrders.length)} de {filteredOrders.length} ordenes
          </p>
          <button
            onClick={onRefresh}
            disabled={loading || isRefreshing}
            aria-label="Actualizar"
            title="Actualizar"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm transition-all active:scale-95 disabled:opacity-30"
          >
            <HiOutlineRefresh className={`w-5 h-5 text-slate-600${isRefreshing ? " animate-spin" : ""}`} />
          </button>
          <div className="flex items-center gap-4">
            <button 
              disabled={safePage === 1} 
              onClick={() => setCurrentPage(p => p - 1)} 
              className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-1 font-bold text-xs">
              <span className="bg-[#4A69BD] text-white px-3 py-1.5 rounded-lg shadow-md shadow-blue-100 min-w-[32px] text-center">
                {safePage}
              </span>
              <span className="text-slate-400 px-1 text-[10px] uppercase">de</span>
              <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg min-w-[32px] text-center">
                {totalPages || 1}
              </span>
            </div>
            <button 
              disabled={safePage === totalPages} 
              onClick={() => {
                setCurrentPage(safePage + 1);
                // ponytail: pre-fetch when approaching the edge of loaded data (2 pages ahead)
                const next = safePage + 1;
                if ((next + 1) * itemsPerPage > orders.length && hasNextPage && fetchNextPage) {
                  fetchNextPage();
                }
              }} 
              className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* --- MODAL DETALLES --- */}
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}