"use client";
import { useState } from "react";
import { HiOutlineEye, HiOutlineCheck, HiOutlineX } from "react-icons/hi";
import { Order } from "../../orders/types/orders";
import { MarketplaceOrderService } from "../services/OrderService";
import { MarketplaceOrderSummary } from "../types/mqtt-orders";
import Tooltip from "./Tooltip";
import { motion, AnimatePresence } from "framer-motion";

interface MarketplaceTableProps {
  orders: Order[];
  queuedOrders?: MarketplaceOrderSummary[];
  loading: boolean;
  onView: (order: Order) => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onFocus?: (id: string) => void;
}

export default function MarketplaceTable({ 
  orders, 
  queuedOrders = [], 
  loading, 
  onView,
  onAccept,
  onReject,
  onFocus
}: MarketplaceTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const totalPages = Math.ceil(orders.length / itemsPerPage);
  const currentOrders = orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="overflow-hidden border border-slate-200 rounded-[2rem] shadow-sm bg-white">
      <div className="overflow-x-auto">
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
                          <Tooltip content="Aceptar Orden">
                            <button 
                              onClick={() => onAccept?.(qOrder.orderId)}
                              className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                            >
                              <HiOutlineCheck size={18} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Ver Detalles">
                            <button 
                              onClick={() => onFocus?.(qOrder.orderId)}
                              className="p-2.5 bg-white border border-blue-500 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                            >
                              <HiOutlineEye size={18} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Rechazar Orden">
                            <button 
                              onClick={() => onReject?.(qOrder.orderId)}
                              className="p-2.5 bg-rose-100 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all active:scale-95"
                            >
                              <HiOutlineX size={18} />
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
                          order.saleStatus === "Completed" ? "bg-emerald-500 text-white" : "bg-[#FFC552] text-white"
                        }`}>
                          {order.saleStatus === "Completed" ? "Completado" : "Pendiente"}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <Tooltip content="Ver Detalles">
                            <button 
                              onClick={() => onView(order)}
                              className="p-2.5 border border-blue-500 rounded-xl text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                            >
                              <HiOutlineEye size={18} />
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
      <div className="p-8 border-t border-slate-100 flex justify-between items-center bg-white">
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
