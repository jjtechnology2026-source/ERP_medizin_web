"use client";

import { useState } from "react";
import { HiOutlineRefresh } from "react-icons/hi";
import { useSearchParams } from "next/navigation";
import MarketplaceStats from "./components/MarketplaceStats";
import MarketplaceFilters from "./components/MarketplaceFilters";
import MarketplaceTable from "./components/MarketplaceTable";
import MarketplaceDetailModal from "./components/MarketplaceDetailModal";
import ChatModal from "./components/ChatModal";
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

  const [chatInfo, setChatInfo] = useState<{ orderId: string; clientName?: string } | null>(null);

  return (
    <div className="flex flex-col gap-10 p-4 md:p-8 min-h-full bg-[#FBFCFE]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.45em] text-slate-500 font-bold mb-1">Marketplace</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Órdenes Pendientes</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => refetch()}
            className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
          >
            <HiOutlineRefresh size={24} />
          </button>
        </div>
      </div>

      <MarketplaceTable
        orders={orders}
        queuedOrders={queuedOrders}
        loading={isLoading}
        onView={setSelectedOrder}
        onAccept={handleAccept}
        onReject={handleReject}
        onFocus={handleViewRealtimeOrder}
        onChat={(orderId, clientName) => setChatInfo({ orderId, clientName })}
      />

      <MarketplaceDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />

      {chatInfo && (
        <ChatModal
          orderId={chatInfo.orderId}
          clientName={chatInfo.clientName}
          onClose={() => setChatInfo(null)}
        />
      )}
    </div>
  );
}
