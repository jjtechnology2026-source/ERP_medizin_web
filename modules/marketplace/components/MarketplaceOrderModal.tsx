import { motion, AnimatePresence } from "framer-motion";
import { HiOutlineClock, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineOfficeBuilding, HiOutlineTruck, HiOutlineCalendar } from "react-icons/hi";
import ModalWrapper from "../../../components/shared/modals/ModalWrapper";
import { MarketplaceOrderService } from "../services/OrderService";
import { MarketplaceOrderSummary } from "../types/mqtt-orders";

interface MarketplaceOrderModalProps {
  order: MarketplaceOrderSummary | null;
  secondsLeft: number;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

export default function MarketplaceOrderModal({ order, secondsLeft, onAccept, onReject, onClose }: MarketplaceOrderModalProps) {
  if (!order) return null;

  // Timer color logic
  const getTimerColor = () => {
    if (secondsLeft >= 30) return "text-emerald-500";
    if (secondsLeft >= 10) return "text-amber-500";
    return "text-rose-500";
  };

  return (
    <ModalWrapper isOpen={!!order} onClose={onClose} zIndex={150}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-4xl max-h-[95vh] rounded-3xl sm:rounded-[2.5rem] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col mx-2 sm:mx-0"
      >
        {/* Header Section - Fixed height, smaller on mobile */}
        <div className="flex flex-row justify-between items-center px-5 sm:px-10 py-4 sm:py-8 border-b border-slate-50 shrink-0">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm sm:text-xl font-bold text-slate-700">Orden Marketplace</h2>
            <div className="flex items-center gap-2">
              <span className={`text-xs sm:text-lg font-black ${getTimerColor()} transition-colors duration-500`}>
                {secondsLeft}s restante
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-6 sm:px-10 py-2 bg-[#E85C33] text-white font-black rounded-xl hover:bg-[#D44A24] transition-all active:scale-95 text-xs sm:text-sm"
          >
            Cerrar
          </button>
        </div>

        {/* Scrollable Content Section */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 sm:px-10 py-4 sm:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
            
            {/* Left Column: Info */}
            <div className="flex flex-col gap-6 sm:gap-10">
              
              {/* Customer Info */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-[10px] sm:text-base font-bold text-slate-500 uppercase tracking-wider">Información del Cliente</h3>
                <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[110px_1fr] gap-y-2 sm:gap-y-3">
                  <span className="text-xs font-bold text-slate-400">Cliente:</span>
                  <span className="text-xs font-black text-slate-700">{order.clientName}</span>
                  
                  <span className="text-xs font-bold text-slate-400">Cédula:</span>
                  <span className="text-xs font-black text-slate-700">{order.clientIdNumber || "---"}</span>
                  
                  <span className="text-xs font-bold text-slate-400">Dirección:</span>
                  <span className="text-xs font-black text-slate-700 leading-tight sm:leading-relaxed">{order.clientAddress}</span>
                </div>
              </div>

              {/* Order Info */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-[10px] sm:text-base font-bold text-slate-500 uppercase tracking-wider">Información de la Orden</h3>
                <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[110px_1fr] gap-y-2 sm:gap-y-3">
                  <span className="text-xs font-bold text-slate-400">ID Orden:</span>
                  <span className="text-xs font-black text-slate-700 break-all">{order.orderId}</span>
                  
                  <span className="text-xs font-bold text-slate-400">Entrega:</span>
                  <span className="text-xs font-black text-slate-700 capitalize">{order.saleType || "Marketplace"}</span>
                  
                  <span className="text-xs font-bold text-slate-400">Fecha:</span>
                  <span className="text-xs font-black text-slate-700">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString('es-ES', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : "Recién llegada"}
                  </span>
                </div>
              </div>

              {/* Total Section */}
              <div className="mt-2 sm:mt-4 flex justify-between items-center border-t border-slate-100 pt-4 sm:pt-6">
                <span className="text-sm sm:text-lg font-bold text-slate-700">Total:</span>
                <span className="text-lg sm:text-2xl font-black text-blue-500">
                  {MarketplaceOrderService.formatCurrency(order.total ?? 0)}
                </span>
              </div>
            </div>

            {/* Right Column: Products */}
            <div className="flex flex-col">
              <h3 className="font-bold text-xs sm:text-base text-slate-500 mb-3 sm:mb-5">Productos:</h3>
              
              <div className="rounded-2xl sm:rounded-[1.5rem] overflow-hidden bg-slate-100/50 border border-slate-100 flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-[40px_1fr_70px] sm:grid-cols-[60px_1fr_90px] text-[9px] sm:text-[11px] font-black text-white p-1">
                  <div className="bg-blue-500 rounded-lg py-2 text-center mr-0.5">Cant.</div>
                  <div className="bg-blue-500 rounded-lg py-2 text-center mr-0.5 px-1 sm:px-4">Producto</div>
                  <div className="bg-blue-500 rounded-lg py-2 text-center">Precio</div>
                </div>

                {/* Items List */}
                <div className="p-1 sm:p-2 flex flex-col gap-1 sm:gap-2 max-h-[250px] lg:max-h-[400px] overflow-y-auto custom-scrollbar">
                  {order.items?.map((item, index) => (
                    <div key={index} className="grid grid-cols-[40px_1fr_70px] sm:grid-cols-[60px_1fr_90px] items-center py-1.5 px-0.5 sm:px-1 hover:bg-white/60 rounded-lg transition-colors">
                      <span className="text-center text-[10px] sm:text-xs font-black text-slate-600">{item.quantity}</span>
                      <div className="px-2 sm:px-4 flex flex-col">
                        <span className="text-[10px] sm:text-xs font-black text-slate-700 leading-tight">{item.name}</span>
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400">Ref: {item.barcode?.slice(-8)}</span>
                      </div>
                      <span className="text-right text-[10px] sm:text-xs font-black text-blue-500">
                        {MarketplaceOrderService.formatCurrency(item.price ?? 0)}
                      </span>
                    </div>
                  ))}
                  {!order.items?.length && (
                    <div className="py-10 text-center">
                      <p className="text-slate-300 font-bold italic text-xs">Sin productos</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons - Fixed at bottom */}
        <div className="px-5 sm:px-10 py-4 sm:py-8 border-t border-slate-50 shrink-0 flex flex-row justify-end gap-3 sm:gap-4 bg-white">
          <button
            onClick={onReject}
            className="flex-1 sm:flex-none sm:px-12 py-3 bg-[#E85C33] text-white font-black rounded-xl hover:bg-[#D44A24] transition-all active:scale-95 text-xs sm:text-sm shadow-lg shadow-rose-100"
          >
            Rechazar
          </button>
          <button
            onClick={onAccept}
            className="flex-1 sm:flex-none sm:px-12 py-3 bg-[#44C08D] text-white font-black rounded-xl hover:bg-[#3AA87C] transition-all active:scale-95 text-xs sm:text-sm shadow-lg shadow-emerald-100"
          >
            Aceptar
          </button>
        </div>
      </motion.div>
    </ModalWrapper>
  );
}
