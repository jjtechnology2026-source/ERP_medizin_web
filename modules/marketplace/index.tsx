"use client";

import { HiOutlineRefresh } from "react-icons/hi";
import { useSearchParams } from "next/navigation";
import MarketplaceStats from "./components/MarketplaceStats";
import MarketplaceFilters from "./components/MarketplaceFilters";
import MarketplaceTable from "./components/MarketplaceTable";
import MarketplaceDetailModal from "./components/MarketplaceDetailModal";
import { useMarketplaceOrders } from "./hooks/useMarketplace";

export default function MarketplaceOrdersFeature() {
  const searchParams = useSearchParams();
  const orderQuery = searchParams?.get("order") ?? undefined;

  const {
    orders,
    isLoading,
    refetch,
    stats,
    activeTab,
    setActiveTab,
    filters,
    setFilters,
    selectedOrder,
    setSelectedOrder,
    mqttConnected,
    queuedOrders,
    handleAccept,
    handleReject,
    handleViewRealtimeOrder,
  } = useMarketplaceOrders(orderQuery);

  return (
    <div className="flex flex-col gap-10 p-4 md:p-8 min-h-full bg-[#FBFCFE]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.45em] text-slate-500 font-bold mb-1">Marketplace</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Órdenes Marketplace</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <div className={`w-3 h-3 rounded-full ${mqttConnected ? "bg-emerald-500" : "bg-rose-500"} animate-pulse`} />
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">MQTT: {mqttConnected ? "En línea" : "Desconectado"}</span>
          </div>
          <button
            onClick={() => refetch()}
            className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
          >
            <HiOutlineRefresh size={24} />
          </button>
        </div>
      </div>

      <MarketplaceStats {...stats} />

      <MarketplaceFilters
        filters={filters}
        setFilters={setFilters}
        onReset={() =>
          setFilters({ status: "", date_start: "", date_end: "", search: "", minPrice: "", maxPrice: "", sortOrder: "desc" })
        }
      />

      {/* Pestañas de Órdenes */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("incoming")}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "incoming"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Órdenes Entrantes
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
            activeTab === "incoming" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
          }`}>
            {stats.pending}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "completed"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Historial y Completadas
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
            activeTab === "completed" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
          }`}>
            {stats.completed}
          </span>
        </button>
      </div>

      <MarketplaceTable
        orders={orders}
        queuedOrders={queuedOrders}
        loading={isLoading}
        onView={setSelectedOrder}
        onAccept={handleAccept}
        onReject={handleReject}
        onFocus={handleViewRealtimeOrder}
      />

      <MarketplaceDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}
