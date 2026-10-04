"use client";
import { useEffect, useState } from "react";
import { HiOutlineExternalLink, HiOutlinePrinter } from "react-icons/hi";
import { Order } from "../types/orders";
import ModalWrapper from "../../../components/shared/modals/ModalWrapper";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { printNoFiscalTicket, prepairPrinter } from "@/modules/cash-register/lib/pos58-print";
import { buildSaleReprintTicket } from "@/modules/cash-register/lib/fiscal-fallback-flow";

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo", dollars: "Dólares", card: "Tarjeta",
  mobile: "Pago Móvil", biopago: "Biopago",
};

const FAILURE_STAGE_LABELS: Record<string, string> = {
  stock: "Inventario (stock)",
  sealing: "Sellado por lote",
  mqtt: "Notificación MQTT",
  movement: "Movimiento de inventario",
  facturacion: "Facturación",
};

const FAILURE_REASON_LABELS: Record<string, string> = {
  rejected_no_stock: "Sin stock suficiente",
  not_found: "Producto no encontrado",
  internal: "Error interno / timeout",
  diverged: "Inventario divergente",
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
  const [isReprinting, setIsReprinting] = useState(false);
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

  const handleReprint = async () => {
    if (!visibleOrder) return;
    setIsReprinting(true);
    try {
      // WebUSB exige gesto del usuario para el pairing: enganchamos la POS80
      // en el mismo click, antes de renderizar/imprimir.
      await prepairPrinter();
      const profile = useAuthStore.getState().profile;
      const header = {
        name: String(profile?.pharmacyName || profile?.name_group || profile?.name || ""),
        rif: String(profile?.rif || ""),
        address: String(profile?.pharmacyAddress || ""),
        phone: String(profile?.pharmacyPhone || ""),
      };
      const result = await printNoFiscalTicket(buildSaleReprintTicket(header, visibleOrder));
      if (!result.printed) {
        alert(result.error || "No se pudo imprimir en la POS");
      }
    } finally {
      setIsReprinting(false);
    }
  };

  if (!visibleOrder) return null;

  const isPipelineFailed = String(visibleOrder.saleStatus ?? "").trim().toLowerCase() === "pipelinefailed";
  const failure = visibleOrder.pipelineFailure;

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
                <DetailItem label="Origen" value={visibleOrder.facturacion?.success ? "Facturación digital" : ""} />
                <DetailItem
                  label="Estado"
                  value={
                    visibleOrder.facturacion?.success
                      ? "Procesada digitalmente"
                      : visibleOrder.facturacion?.error
                        ? `Error: ${String(visibleOrder.facturacion.error)}`
                        : "Sin facturación registrada"
                  }
                />
                <DetailItem
                  label="Nro Interno Fiscal"
                  value={visibleOrder.facturacion?.resp?.numerointerno || visibleOrder.numeroControlInterno}
                />
                <DetailItem label="Control Fiscal" value={visibleOrder.facturacion?.resp?.numerocontrol} />
                <DetailItem
                  label="Tracking / Serial"
                  value={visibleOrder.facturacion?.resp?.trackingid || visibleOrder.id}
                  isSmall
                  isFull
                />
                <DetailItem
                  label="Fecha Fiscal"
                  value={
                    visibleOrder.facturacion?.resp?.fecha
                      ? new Date(visibleOrder.facturacion.resp.fecha).toLocaleString("es-VE")
                      : ""
                  }
                  isSmall
                  isFull
                />
              </div>
              {/* Sección corregida del PDF fiscal */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-3">
                <span className="text-[10px] font-black text-slate-900 uppercase block">PDF fiscal:</span>
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
                <button
                  onClick={handleReprint}
                  disabled={isReprinting}
                  className="text-[#059669] text-sm font-black flex items-center gap-1 hover:underline active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isReprinting ? "Imprimiendo..." : "Reimprimir factura"} <HiOutlinePrinter size={18} />
                </button>
              </div>
            </div>

            {isPipelineFailed && (
              <div className="bg-red-50 border border-red-100 rounded-[32px] p-8 space-y-5">
                <h4 className="font-black text-red-700 text-xs uppercase tracking-widest">Fallo del proceso de venta</h4>
                <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                  <DetailItem
                    label="Etapa"
                    value={failure ? FAILURE_STAGE_LABELS[failure.stage] || failure.stage : ""}
                  />
                  <DetailItem
                    label="Motivo"
                    value={failure ? FAILURE_REASON_LABELS[failure.reasonCode] || failure.reasonCode : ""}
                  />
                  <DetailItem label="Unidades aplicadas" value={failure ? String(failure.applied) : ""} />
                  <DetailItem label="Compensado" value={failure ? (failure.compensated ? "Sí" : "No") : ""} />
                  <DetailItem label="Divergencia" value={failure ? (failure.diverged ? "Sí" : "No") : ""} />
                  <DetailItem label="Intentos" value={failure ? String(failure.attempts) : ""} />
                  <DetailItem
                    label="Ocurrió"
                    value={failure?.attemptedAt ? new Date(failure.attemptedAt).toLocaleString("es-VE") : ""}
                    isFull
                  />
                </div>
                {!failure && (
                  <p className="text-[11px] text-red-700 leading-snug">
                    Sin evidencia persistida para esta orden (fila anterior a que existiera el registro del fallo).
                  </p>
                )}
                <p className="text-[11px] text-red-700 leading-snug">
                  El corte de 10 s del pipeline es del lado del cliente: el inventario pudo descontarse igual.
                  Verificar el stock antes de reintentar la venta.
                </p>
              </div>
            )}
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
                    <span className="text-right font-black text-slate-600">$ {med.price.toFixed(2)}</span>
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

