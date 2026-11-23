"use client";
import { HiOutlineXCircle } from "react-icons/hi";
import { Order } from "../../orders/types/orders";
import ModalWrapper from "../../../components/shared/modals/ModalWrapper";
import { MarketplaceOrderService } from "../services/OrderService";

interface MarketplaceDetailModalProps {
  order: Order | null;
  onClose: () => void;
}

export default function MarketplaceDetailModal({ order, onClose }: MarketplaceDetailModalProps) {
  if (!order) return null;

  const handleClose = () => {
    onClose();
  };

  const totalOrder = order.totalreal || order.medications?.reduce((acc, med) => acc + (med.price * med.quantity), 0) || 0;

  return (
    <ModalWrapper isOpen={!!order} onClose={handleClose} zIndex={100}>
      {/* `ModalWrapper` centers its child and does not scroll, so below `lg` the
          panel itself becomes the vertical scroller and is clamped to the
          viewport. Desktop geometry is untouched (spec S4). */}
      <div className="w-full max-w-6xl rounded-[3rem] bg-white shadow-2xl overflow-hidden flex flex-col p-4 max-lg:max-h-[calc(100dvh-3rem)] max-lg:overflow-y-auto max-lg:rounded-3xl">
        {/* Header (Match Image 3) — stacked on a phone: the `h2` and the close
            button do not fit one 310px row. */}
        <div className="flex justify-between items-center px-4 py-4 lg:px-10 lg:py-8 max-lg:flex-col max-lg:items-stretch max-lg:gap-3">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight max-lg:text-lg">Detalles de la Orden - Marketplace</h2>
          <button
            onClick={handleClose}
            className="px-12 py-4 bg-[#FF3B30] text-white font-black rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-100 active:scale-95 text-lg max-lg:min-h-12 max-lg:w-full max-lg:px-4 max-lg:text-base"
          >
            Cerrar
          </button>
        </div>

        <div className="px-4 pb-6 lg:px-10 lg:pb-10 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 max-lg:gap-6">
          
          {/* Columna Izquierda: Información */}
          <div className="flex flex-col gap-12 max-lg:gap-6">
            
            {/* Información del Cliente */}
            <div className="space-y-8 max-lg:space-y-4">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Información del Cliente</h3>
              <div className="grid grid-cols-1 gap-y-5">
                {/* Below `lg` the fixed 140px label column left ~138px for the
                    value at 390px, so a long unbroken name/address overflowed the
                    card. Phone stacks label above value and breaks long tokens. */}
                <div className="grid grid-cols-[140px_1fr] items-center max-lg:grid-cols-1 max-lg:gap-y-0.5">
                  <span className="text-base font-bold text-slate-400">Cliente:</span>
                  <span className="min-w-0 text-base font-black text-slate-800 wrap-break-word">{order.client?.name || "Sin nombre"}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center max-lg:grid-cols-1 max-lg:gap-y-0.5">
                  <span className="text-base font-bold text-slate-400">Cédula:</span>
                  <span className="min-w-0 text-base font-black text-slate-800 wrap-break-word">{order.client?.documento || "---"}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-start max-lg:grid-cols-1 max-lg:gap-y-0.5">
                  <span className="text-base font-bold text-slate-400 pt-1">Dirección:</span>
                  <span className="min-w-0 text-base font-black text-slate-800 leading-relaxed wrap-break-word">{order.client?.direccion || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Información de la Orden */}
            <div className="space-y-8 max-lg:space-y-4">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Información de la Orden</h3>
              <div className="grid grid-cols-1 gap-y-5">
                <div className="grid grid-cols-[140px_1fr] items-center max-lg:grid-cols-1 max-lg:gap-y-0.5">
                  <span className="text-base font-bold text-slate-400">ID de Orden:</span>
                  <span className="min-w-0 text-base font-black text-slate-800 break-all">{order.id}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center max-lg:grid-cols-1 max-lg:gap-y-0.5">
                  <span className="text-base font-bold text-slate-400">Tipo de entrega:</span>
                  <span className="min-w-0 text-base font-black text-slate-800 capitalize wrap-break-word">{order.saleType || "Marketplace"}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center max-lg:grid-cols-1 max-lg:gap-y-0.5">
                  <span className="text-base font-bold text-slate-400">Fecha:</span>
                  <span className="min-w-0 text-base font-black text-slate-800 wrap-break-word">{new Date(order.date).toLocaleString('es-VE')}</span>
                </div>
              </div>
            </div>

            {/* Total Box (Bottom Left as in Image 3) */}
            <div className="mt-auto bg-[#F1F6FE] rounded-[2rem] p-4 lg:p-10 flex justify-between items-center max-lg:flex-col max-lg:items-start max-lg:gap-1">
              <span className="text-2xl font-black text-slate-800 max-lg:text-base">Total de la Orden:</span>
              <span className="text-4xl font-black text-blue-600 tracking-tighter max-lg:text-2xl">{totalOrder.toFixed(2)} USD</span>
            </div>
          </div>

          {/* Columna Derecha: Lista de productos (Match Image 3) */}
          <div className="bg-[#E9E9E9] rounded-[3rem] p-4 lg:p-10 flex flex-col min-h-0 lg:min-h-[500px] max-lg:rounded-3xl">
            <h3 className="font-black text-xl text-slate-800 tracking-tight mb-8 max-lg:mb-4">Lista de productos:</h3>
            
            <div className="rounded-[1.5rem] overflow-hidden bg-white shadow-sm flex flex-col flex-1">
              {/* Blue Header Section — desktop only: the phone rows label themselves. */}
              <div className="grid grid-cols-[80px_1fr_120px] text-[14px] font-black text-white p-1 max-lg:hidden">
                <div className="bg-blue-600 rounded-xl py-4 text-center mr-1">Cant.</div>
                <div className="bg-blue-600 rounded-xl py-4 text-center mr-1 px-4">Producto</div>
                <div className="bg-blue-600 rounded-xl py-4 text-center">Precio</div>
              </div>

              {/* Items Section */}
              <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[600px] max-lg:p-3 max-lg:gap-4 max-lg:max-h-none max-lg:overflow-visible">
                {order.medications?.map((med, idx) => (
                  <div key={idx} className="grid grid-cols-[80px_1fr_120px] items-center border-b border-slate-50 pb-6 last:border-0 last:pb-0 max-lg:block max-lg:pb-4 max-lg:last:pb-0">
                    {/* Phone: one readable block per item, the numbers on their
                        own line (the fixed 80/1fr/120 template crushed the name
                        at 390px and the price fell outside the card). */}
                    <div className="flex min-w-0 flex-col gap-1 lg:hidden">
                      <p className="text-sm font-black leading-snug text-slate-800 wrap-break-word">{med.name}</p>
                      <p className="text-xs font-bold text-slate-400 break-words">Código: {order.id.slice(-10).toUpperCase()}</p>
                      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-black">
                        <span className="text-slate-800">Cant. {med.quantity}</span>
                        <span className="text-blue-600">{med.price.toFixed(2)} USD</span>
                      </p>
                    </div>
                    <span className="text-center text-lg font-black text-slate-800 max-lg:hidden">{med.quantity}</span>
                    <div className="px-6 flex flex-col max-lg:hidden">
                      <span className="text-lg font-black text-slate-800 leading-tight">{med.name}</span>
                      <span className="text-xs font-bold text-slate-400 mt-1">Código: {order.id.slice(-10).toUpperCase()}</span>
                    </div>
                    <span className="text-right text-lg font-black text-blue-600 max-lg:hidden">{med.price.toFixed(2)} USD</span>
                  </div>
                ))}
                {!order.medications?.length && (
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
