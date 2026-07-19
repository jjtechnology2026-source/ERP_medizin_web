"use client";
import { useEffect, useState } from "react";
import { HiOutlineExternalLink, HiOutlineDocumentReport } from "react-icons/hi";
import { Order } from "../types/orders";
import ModalWrapper from "../../../components/shared/modals/ModalWrapper";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import FiscalNoteDialog from "./FiscalNoteDialog";
import FiscalNoteDetailDialog from "./FiscalNoteDetailDialog";
import { fiscalNotesService } from "@/modules/cash-register/api/fiscal-notes.service";
import type { FiscalNoteDetail } from "@/modules/cash-register/types/fiscal-notes.types";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

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
  const usesDigitalBilling = useAuthStore((s) => s.profile?.usesDigitalBilling) ?? false;

  const [showFiscalNoteDialog, setShowFiscalNoteDialog] = useState(false);
  const [fiscalNotesNC, setFiscalNotesNC] = useState<FiscalNoteDetail[]>([]);
  const [fiscalNotesND, setFiscalNotesND] = useState<FiscalNoteDetail[]>([]);
  const [fiscalNotesLoading, setFiscalNotesLoading] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNoteType, setSelectedNoteType] = useState<"NC" | "ND">("NC");

  useEffect(() => {
    if (order) {
      setVisibleOrder(order);
      setIsOpen(true);
      if (usesDigitalBilling) loadFiscalNotes(order.id);
      return;
    }

    setIsOpen(false);
    setFiscalNotesNC([]);
    setFiscalNotesND([]);
  }, [order]);

  const loadFiscalNotes = async (orderId: string) => {
    setFiscalNotesLoading(true);
    const [ncResult, ndResult] = await Promise.all([
      fiscalNotesService.listNotasCredito({ order_id: orderId }),
      fiscalNotesService.listNotasDebito({ order_id: orderId }),
    ]);
    setFiscalNotesNC(ncResult.items);
    setFiscalNotesND(ndResult.items);
    setFiscalNotesLoading(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setVisibleOrder(null);
      onClose();
    }, 330);
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
                {visibleOrder.payments && visibleOrder.payments.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {visibleOrder.payments.map((p: any, i: number) => {
                      const method = p?.method;
                      const rawAmount = p?.amount ?? 0;
                      if (!method) return null;
                      const label = PAYMENT_LABELS[method] || method;
                      const isUsd = method === "dollars" || p?.currency === "USD";
                      const orderRate = visibleOrder.rate || rate;
                      const usdAmount = isUsd ? rawAmount : rawAmount / Math.max(orderRate, 1);
                      const displayAmount = `$ ${Number(usdAmount).toFixed(2)}`;
                      return (
                        <span key={i} className="text-sm font-medium text-slate-600 leading-tight">
                          {label}: {displayAmount}
                        </span>
                      );
                    })}
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

            {usesDigitalBilling && (
            <div className="bg-slate-50 border border-slate-100 rounded-[32px] p-8 space-y-5">
              <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest">Notas Fiscales</h4>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowFiscalNoteDialog(true)}
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all"
                >
                  Emitir NC
                </button>
                <button
                  onClick={() => setShowFiscalNoteDialog(true)}
                  className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black transition-all"
                >
                  Emitir ND
                </button>
              </div>

              {fiscalNotesLoading && (
                <p className="text-xs text-slate-400">Cargando notas fiscales...</p>
              )}

              {!fiscalNotesLoading && fiscalNotesNC.length + fiscalNotesND.length === 0 && (
                <p className="text-xs text-slate-400">Sin notas fiscales emitidas.</p>
              )}

              {fiscalNotesNC.length > 0 && (
                <div>
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block mb-2">
                    Notas de Crédito ({fiscalNotesNC.length})
                  </span>
                  <div className="space-y-2">
                    {fiscalNotesNC.map((note) => (
                      <NoteCard
                        key={note.id || note.numero_control}
                        note={note}
                        type="NC"
                        onClick={() => { setSelectedNoteId(note.id!); setSelectedNoteType("NC"); }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {fiscalNotesND.length > 0 && (
                <div>
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-wider block mb-2 mt-3">
                    Notas de Débito ({fiscalNotesND.length})
                  </span>
                  <div className="space-y-2">
                    {fiscalNotesND.map((note) => (
                      <NoteCard
                        key={note.id || note.numero_control}
                        note={note}
                        type="ND"
                        onClick={() => { setSelectedNoteId(note.id!); setSelectedNoteType("ND"); }}
                      />
                    ))}
                  </div>
                </div>
              )}
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
                    <span className="text-right font-black text-slate-600">{med.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
      </div>
      {showFiscalNoteDialog && visibleOrder && usesDigitalBilling && (
        <FiscalNoteDialog order={visibleOrder} onClose={() => setShowFiscalNoteDialog(false)} />
      )}
      {selectedNoteId && usesDigitalBilling && (
        <FiscalNoteDetailDialog
          noteId={selectedNoteId}
          noteType={selectedNoteType}
          onClose={() => setSelectedNoteId(null)}
        />
      )}
    </div>
    </ModalWrapper>
  );
}

const NoteCard = ({ note, type, onClick }: { note: FiscalNoteDetail; type: "NC" | "ND"; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 cursor-pointer transition-all"
  >
    <div className="flex justify-between items-start mb-2">
      <span className="text-xs font-bold text-slate-700 font-mono">{note.numero_control}</span>
      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
        type === "NC" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
      }`}>
        {type}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <span className="text-slate-400 block">Base imponible</span>
        <span className="font-bold text-slate-800">Bs {note.base_imponible_ves.toFixed(2)}</span>
      </div>
      <div>
        <span className="text-slate-400 block">IVA ({note.iva_porcentaje}%)</span>
        <span className="font-bold text-slate-800">Bs {note.iva_monto_ves.toFixed(2)}</span>
      </div>
      <div>
        <span className="text-slate-400 block">Total Bs</span>
        <span className="font-bold text-emerald-600">Bs {note.total_ves.toFixed(2)}</span>
      </div>
      <div>
        <span className="text-slate-400 block">Motivo</span>
        <span className="font-bold text-slate-800 truncate">{note.motivo || "—"}</span>
      </div>
    </div>
    {note.url_pdf && (
      <a
        href={note.url_pdf}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-blue-600 hover:underline"
      >
        Ver PDF <HiOutlineExternalLink size={12} />
      </a>
    )}
  </div>
);