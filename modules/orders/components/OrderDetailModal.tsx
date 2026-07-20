"use client";
import { useEffect, useState } from "react";
import { HiOutlineExternalLink } from "react-icons/hi";
import { Order } from "../types/orders";
import ModalWrapper from "../../../components/shared/modals/ModalWrapper";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo", dollars: "Dólares", card: "Tarjeta",
  mobile: "Pago Móvil", biopago: "Biopago",
};

const DetailItem = ({ label, value, isSmall = false, isFull = false }: { label: string, value: any, isSmall?: boolean, isFull?: boolean }) => (
  <div className={`flex flex-col ${isFull ? 'col-span-2' : ''}`}>
    <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter mb-0.5">{label}</span>
    <span className={`text-slate-600 leading-tight ${isSmall ? 'text-[11px] font-mono break-all' : 'text-sm font-medium'}`}>
      {value || '---'}
    </span>
  </div>
);

export default function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const [visibleOrder, setVisibleOrder] = useState<Order | null>(order);
  const [isOpen, setIsOpen] = useState(!!order);
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

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
    setVisibleOrder(null);
    onClose();
  };

  if (!visibleOrder) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={handleClose} zIndex={100}>
      <div className="w-full max-w-4xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center px-10 py-8">
          <h2 className="text-2xl font-black text-slate-800">Detalles de la orden</h2>
          <button
            onClick={handleClose}
            className="px-10 py-2.5 bg-[#FF3B30] text-white font-black rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-100 active:scale-95"
          >
            Cerrar
          </button>
        </div>

        <div className="px-10 pb-10 grid grid-cols-1 md:grid-cols-2 gap-10 overflow-y-auto max-h-[75vh]">
          {/* Columna Izquierda */}
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <DetailItem label="RIF o Cédula" value={visibleOrder.client?.documento} />
              <DetailItem label="Nombres y Apellidos" value={visibleOrder.client?.name} />
              <DetailItem label="Dirección" value={visibleOrder.client?.direccion} isFull />
              <DetailItem label="Sexo" value={visibleOrder.gender || ''} />
              <DetailItem label="Número de la orden" value={visibleOrder.id} isSmall />
              <DetailItem label="Tipo de entrega" value={visibleOrder.saleType} />
              <DetailItem label="Agente" value={visibleOrder.nameAgent || ''} />
              <DetailItem label="Fecha y hora de la orden" value={new Date(visibleOrder.date).toLocaleString('es-VE')} />
              <div className="flex flex-col col-span-2">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter mb-0.5">Tipo de pago</span>
                {visibleOrder.payments?.length ? (
                  <div className="flex flex-col gap-1">
                    {renderPayments(visibleOrder.payments, visibleOrder.rate || rate)}
                  </div>
                ) : (
                  <span className="text-sm font-medium text-slate-400 leading-tight">—</span>
                )}
              </div>
              <DetailItem label="Monto" value={`${visibleOrder.totalreal.toFixed(2)} USD`} />
              <DetailItem label="Controlado" value={visibleOrder.isControlled ? 'Sí' : 'No'} />
              <DetailItem label="Total de la orden" value={`${visibleOrder.totalreal.toFixed(2)} USD`} />
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-[32px] p-8 space-y-5">
              <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest">Información fiscal</h4>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <DetailItem label="Origen" value="Facturación digital" />
                <DetailItem label="Estado" value="Procesada digitalmente" />
                <DetailItem label="Nro Interno Fiscal" value="00001306" />
                <DetailItem label="Control Fiscal" value="00-00001325" />
                <DetailItem label="Tracking / Serial" value={visibleOrder.id} isSmall isFull />
                <DetailItem label="Fecha Fiscal" value={new Date(visibleOrder.date).toISOString()} isSmall isFull />
              </div>
              {/* Sección corregida del PDF fiscal */}
              <div className="pt-4 border-t border-slate-200">
                <span className="text-[10px] font-black text-slate-900 uppercase mb-2 block">PDF fiscal:</span>
                <button
                  onClick={() => {
                    // Accedemos a la ruta exacta según tu JSON
                    const pdfUrl = visibleOrder.facturacion?.resp?.urlpdf;

                    if (pdfUrl) {
                      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
                    } else {
                      alert("El enlace de la factura no está disponible en esta orden.");
                    }
                  }}
                  className="text-[#1D68EF] text-sm font-black flex items-center gap-1 hover:underline active:scale-95"
                >
                  Ver factura <HiOutlineExternalLink size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="bg-slate-50/50 rounded-[32px] p-6 border border-slate-100 h-fit">
            <h3 className="font-black text-xs uppercase tracking-widest mb-5 text-slate-900">Lista de productos:</h3>
            <div className="rounded-[24px] overflow-hidden border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-[60px_1fr_80px] text-[10px] font-black text-white bg-[#1D68EF] p-4 uppercase tracking-tight">
                <span>Cant</span><span>Producto</span><span className="text-right">Importe</span>
              </div>
              <div className="max-h-[450px] overflow-y-auto divide-y divide-slate-50">
                {visibleOrder.medications?.map((med, idx) => (
                  <div key={idx} className="grid grid-cols-[60px_1fr_80px] text-xs p-4 items-center hover:bg-blue-50/30 transition-colors">
                    <span className="text-slate-400 font-bold">{med.quantity}.0</span>
                    <span className="text-slate-800 font-bold truncate pr-2">{med.name}</span>
                    <span className="text-right font-black text-slate-600">{med.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
      </div>

    </div>
    </ModalWrapper>
  );
}

function renderPayments(payments: any[], rate: number) {
  return payments.map((p: any, i: number) => {
    const method = p?.method;
    const rawAmount = p?.amount ?? 0;
    if (!method) return null;
    const label = PAYMENT_LABELS[method] || method;
    const isUsd = method === "dollars" || p?.currency === "USD";
    const usdAmount = isUsd ? rawAmount : rawAmount / Math.max(rate, 1);
    const displayAmount = `$ ${Number(usdAmount).toFixed(2)}`;
    return (
      <span key={i} className="text-sm font-medium text-slate-600 leading-tight">
        {label}: {displayAmount}
      </span>
    );
  });
}

