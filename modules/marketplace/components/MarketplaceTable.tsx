"use client";
import { useState } from "react";
import { HiOutlineEye, HiOutlineCheck, HiOutlineX, HiOutlineChatAlt2 } from "react-icons/hi";
import { Order } from "../../orders/types/orders";
import { MarketplaceOrderService } from "../services/OrderService";
import { MarketplaceOrderSummary } from "../types/mqtt-orders";
import Tooltip from "./Tooltip";
import MarketplaceCardList from "./MarketplaceCardList";
import { isCompletedOrder } from "../lib/order-status";
import { motion, AnimatePresence } from "framer-motion";

interface MarketplaceTableProps {
  orders: Order[];
  queuedOrders?: MarketplaceOrderSummary[];
  loading: boolean;
  onView: (order: Order) => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onFocus?: (id: string) => void;
  onChat?: (orderId: string, clientName?: string) => void;
}

export default function MarketplaceTable({ 
  orders, 
  queuedOrders = [], 
  loading, 
  onView,
  onAccept,
  onReject,
  onFocus,
  onChat
}: MarketplaceTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(orders.length / itemsPerPage);
  const currentOrders = orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Shared by the desktop table and the phone card list: a Redis-queued order is
  // complete enough to open as-is, an MQTT one has to be focused by id.
  const openQueuedOrder = (qOrder: MarketplaceOrderSummary) => {
    if ((qOrder as any)._source === "redis") {
      onView({
        id: qOrder.orderId,
        client: {
          name: qOrder.clientName,
          direccion: qOrder.clientAddress || "",
          documento: qOrder.clientIdNumber || "",
        },
        date: qOrder.createdAt || new Date().toISOString(),
        saleType: qOrder.saleType || "Marketplace",
        saleStatus: "Pending",
        medications: (qOrder.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price ?? 0,
        })),
        totalreal: qOrder.total,
      } as any);
    } else {
      onFocus?.(qOrder.orderId);
    }
  };

  return (
    <div className="overflow-hidden border border-slate-200 rounded-[2rem] shadow-sm bg-white">
      {/* Phone (S7): seven columns and `px-8` cells never fit 390px, and the
          shell clips the overflow, so status and the row actions were simply
          cut off. Below `lg` the same orders render as cards. */}
      <div className="p-3 lg:hidden">
        <MarketplaceCardList
          orders={currentOrders}
          queuedOrders={queuedOrders}
          loading={loading}
          onView={onView}
          onAccept={onAccept}
          onChat={onChat}
          onOpenQueued={openQueuedOrder}
        />
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left relative">
          <thead className="bg-white border-b border-slate-100">
            <tr>
              {["ID", "NOMBRES", "DIRECCIÓN", "FECHA", "TIPO DE VENTA", "STATUS", "ACCIONES"].map((h) => (
                <th key={h} className="px-8 py-6 text-[10px] font-black text-slate-900 uppercase tracking-widest">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-20 text-slate-400 font-bold italic">
                  Cargando órdenes de marketplace...
                </td>
              </tr>
            ) : (
              <>
                {/* Real-time Queued Orders (Queued) */}
                <AnimatePresence mode="popLayout">
                  {queuedOrders.map((qOrder, index) => (
                    <motion.tr 
                      key={qOrder.orderId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      className="bg-blue-50/40 hover:bg-blue-50 transition-colors border-l-4 border-l-blue-500"
                    >
                      <td className="px-8 py-5 text-xs font-black text-blue-600">#{qOrder.orderId.slice(-8)}</td>
                      <td className="px-8 py-5 text-xs font-black text-slate-900 capitalize">{qOrder.clientName}</td>
                      <td className="px-8 py-5 text-[10px] font-bold text-slate-400 max-w-[200px] truncate capitalize">
                        {qOrder.clientAddress}
                      </td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-500">Recién llegada</td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-500 capitalize">{qOrder.saleType || "Delivery"}</td>
                      <td className="px-8 py-5">
                        <span className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-lg shadow-blue-100">
                          NUEVA
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <Tooltip content="Finalizar Orden">
                            <button 
                              onClick={() => onAccept?.(qOrder.orderId)}
                              className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                            >
                              <HiOutlineCheck size={18} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Ver Detalles">
                            <button 
                              onClick={() => openQueuedOrder(qOrder)}
                              className="p-2.5 bg-white border border-blue-500 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                            >
                              <HiOutlineEye size={18} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Chat con Cliente">
                            <button 
                              onClick={() => onChat?.(qOrder.orderId, qOrder.clientName)}
                              className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all active:scale-95"
                            >
                              <HiOutlineChatAlt2 size={18} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>

                {/* Historical Orders */}
                {orders.length === 0 && queuedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-slate-500 font-bold">
                      No se encontraron órdenes de marketplace.
                    </td>
                  </tr>
                ) : (
                  currentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 text-xs font-bold text-slate-700">{order.id?.slice(0, 8).toLowerCase()}</td>
                      <td className="px-8 py-5 text-xs font-black text-slate-900 capitalize">{order.client?.name || "Sin nombre"}</td>
                      <td className="px-8 py-5 text-[10px] font-bold text-slate-400 max-w-[200px] truncate capitalize">
                        {order.client?.direccion || "N/A"}
                      </td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-500">{new Date(order.date).toLocaleDateString()}</td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-500 capitalize">{order.saleType || "Delivery"}</td>
                      <td className="px-8 py-5">
                        <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                          isCompletedOrder(order) ? "bg-emerald-500 text-white" : "bg-[#FFC552] text-white"
                        }`}>
                          {isCompletedOrder(order) ? "Completado" : "Pendiente"}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <Tooltip content="Finalizar Orden">
                            <button 
                              onClick={() => onAccept?.(order.id)}
                              className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                            >
                              <HiOutlineCheck size={18} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Ver Detalles">
                            <button 
                              onClick={() => onView(order)}
                              className="p-2.5 border border-blue-500 rounded-xl text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                            >
                              <HiOutlineEye size={18} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Chat con Cliente">
                            <button 
                              onClick={() => onChat?.(order.id, order.client?.name)}
                              className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all active:scale-95"
                            >
                              <HiOutlineChatAlt2 size={18} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:p-8">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
          Mostrando {currentOrders.length + (currentPage === 1 ? queuedOrders.length : 0)} de {orders.length + queuedOrders.length} órdenes
        </p>
        <div className="flex items-center gap-4">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="p-4 rounded-2xl border border-slate-100 bg-white disabled:opacity-30 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2 font-black text-sm">
            <span className="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-100">{currentPage}</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-slate-500">{totalPages || 1}</span>
          </div>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="p-4 rounded-2xl border border-slate-100 bg-white disabled:opacity-30 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
