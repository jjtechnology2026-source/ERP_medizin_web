"use client";
import { useEffect, useState } from "react";
import { HiOutlineXCircle } from "react-icons/hi";
import { Order } from "../../orders/types/orders";
import ModalWrapper from "../../../components/shared/modals/ModalWrapper";
import { MarketplaceOrderService } from "../services/OrderService";

interface MarketplaceDetailModalProps {
  order: Order | null;
  onClose: () => void;
}

export default function MarketplaceDetailModal({ order, onClose }: MarketplaceDetailModalProps) {
  const [visibleOrder, setVisibleOrder] = useState<Order | null>(order);
  const [isOpen, setIsOpen] = useState(!!order);

  useEffect(() => {
    if (order) {
      setVisibleOrder(order);
      setIsOpen(true);
      return;
    }
    setIsOpen(false);
  }, [order]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setVisibleOrder(null);
      onClose();
    }, 330);
  };

  if (!visibleOrder) return null;

  // Cálculo del total (usando totalreal o sumando items)
  const totalOrder = visibleOrder.totalreal || visibleOrder.medications?.reduce((acc, med) => acc + (med.price * med.quantity), 0) || 0;

  return (
    <ModalWrapper isOpen={isOpen} onClose={handleClose} zIndex={100}>
      <div className="w-full max-w-6xl rounded-[3rem] bg-white shadow-2xl overflow-hidden flex flex-col p-4">
        {/* Header (Match Image 3) */}
        <div className="flex justify-between items-center px-10 py-8">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Detalles de la Orden - Marketplace</h2>
          <button
            onClick={handleClose}
            className="px-12 py-4 bg-[#FF3B30] text-white font-black rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-100 active:scale-95 text-lg"
          >
            Cerrar
          </button>
        </div>

        <div className="px-10 pb-10 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12">
          
          {/* Columna Izquierda: Información */}
          <div className="flex flex-col gap-12">
            
            {/* Información del Cliente */}
            <div className="space-y-8">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Información del Cliente</h3>
              <div className="grid grid-cols-1 gap-y-5">
                <div className="grid grid-cols-[140px_1fr] items-center">
                  <span className="text-base font-bold text-slate-400">Cliente:</span>
                  <span className="text-base font-black text-slate-800">{visibleOrder.client?.name || "Sin nombre"}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center">
                  <span className="text-base font-bold text-slate-400">Cédula:</span>
                  <span className="text-base font-black text-slate-800">{visibleOrder.client?.documento || "---"}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-start">
                  <span className="text-base font-bold text-slate-400 pt-1">Dirección:</span>
                  <span className="text-base font-black text-slate-800 leading-relaxed">{visibleOrder.client?.direccion || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Información de la Orden */}
            <div className="space-y-8">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Información de la Orden</h3>
              <div className="grid grid-cols-1 gap-y-5">
                <div className="grid grid-cols-[140px_1fr] items-center">
                  <span className="text-base font-bold text-slate-400">ID de Orden:</span>
                  <span className="text-base font-black text-slate-800 break-all">{visibleOrder.id}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center">
                  <span className="text-base font-bold text-slate-400">Tipo de entrega:</span>
                  <span className="text-base font-black text-slate-800 capitalize">{visibleOrder.saleType || "Marketplace"}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center">
                  <span className="text-base font-bold text-slate-400">Fecha:</span>
                  <span className="text-base font-black text-slate-800">{new Date(visibleOrder.date).toLocaleString('es-VE')}</span>
                </div>
              </div>
            </div>

            {/* Total Box (Bottom Left as in Image 3) */}
            <div className="mt-auto bg-[#F1F6FE] rounded-[2rem] p-10 flex justify-between items-center">
              <span className="text-2xl font-black text-slate-800">Total de la Orden:</span>
              <span className="text-4xl font-black text-blue-600 tracking-tighter">{totalOrder.toFixed(2)} USD</span>
            </div>
          </div>

          {/* Columna Derecha: Lista de productos (Match Image 3) */}
          <div className="bg-[#E9E9E9] rounded-[3rem] p-10 flex flex-col min-h-[500px]">
            <h3 className="font-black text-xl text-slate-800 tracking-tight mb-8">Lista de productos:</h3>
            
            <div className="rounded-[1.5rem] overflow-hidden bg-white shadow-sm flex flex-col flex-1">
              {/* Blue Header Section */}
              <div className="grid grid-cols-[80px_1fr_120px] text-[14px] font-black text-white p-1">
                <div className="bg-blue-600 rounded-xl py-4 text-center mr-1">Cant.</div>
                <div className="bg-blue-600 rounded-xl py-4 text-center mr-1 px-4">Producto</div>
                <div className="bg-blue-600 rounded-xl py-4 text-center">Precio</div>
              </div>

              {/* Items Section */}
              <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[600px]">
                {visibleOrder.medications?.map((med, idx) => (
                  <div key={idx} className="grid grid-cols-[80px_1fr_120px] items-center border-b border-slate-50 pb-6 last:border-0 last:pb-0">
                    <span className="text-center text-lg font-black text-slate-800">{med.quantity}</span>
                    <div className="px-6 flex flex-col">
                      <span className="text-lg font-black text-slate-800 leading-tight">{med.name}</span>
                      <span className="text-xs font-bold text-slate-400 mt-1">Código: {visibleOrder.id.slice(-10).toUpperCase()}</span>
                    </div>
                    <span className="text-right text-lg font-black text-blue-600">{med.price.toFixed(2)} USD</span>
                  </div>
                ))}
                {!visibleOrder.medications?.length && (
                  <p className="text-center py-20 text-slate-400 font-bold italic text-lg">No hay productos listados</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}
