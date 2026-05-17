"use client";
import { useState } from "react";
import { HiX } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type {
  PaymentMethod,
  CashPayment,
  DollarPayment,
  CardPayment,
  MobilePayment,
  BiopagoPayment,
} from "@/modules/cash-register/types/cashier.types";

const PAYMENT_ICONS: Record<PaymentMethod, string> = {
  efectivo: "\u{1F4B0}",
  dolares: "$",
  tarjeta: "\u{1F4B3}",
  pagomovil: "\u{1F4F1}",
  biopago: "\u{1F535}",
};

const VENEZUELAN_BANKS = [
  "Banco de Venezuela", "Mercantil", "Provincial", "Banesco", "BOD",
  "Exterior", "Nacional de Crédito", "Del Tesoro", "Caroní", "Activo",
];

const CARD_TYPES = ["Débito", "Crédito"];

export default function PaymentDialog({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const {
    getComputedTotals,
    selectedPaymentMethod,
    setPaymentMethod,
    payments,
    setPayment,
  } = useCurrentOrderStore();
  const { registerSale, activeSession } = useCashierWorkflowStore();
  const { getEffectiveRate } = useCurrencyStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const totals = getComputedTotals();
  const rate = getEffectiveRate();

  const formatPrice = (amount: number) => {
    const rateVal = rate || 300;
    return `Bs ${amount.toFixed(2)}`;
  };

  const baseAmount = totals.subtotal > 0
    ? totals.subtotal / (1 + totals.totalVat / totals.subtotal)
    : 0;
  const igtf = selectedPaymentMethod === "dolares" ? totals.total * 0.03 : 0;

  const updatePayment = (partial: Record<string, any>) => {
    const base = payments[selectedPaymentMethod];
    setPayment({ ...base, ...partial } as any);
  };

  const handlePaymentSubmit = async () => {
    setIsProcessing(true);
    try {
      const payment = payments[selectedPaymentMethod];
      if (!payment || payment.amount <= 0) return;

      const controlNumber = `FAC-${Date.now()}`;

      const order = useCurrentOrderStore.getState().getCurrentOrder();

      await registerSale({
        sesion_caja_id: activeSession?.id ?? "",
        numero_control: controlNumber,
        cliente_nombre: order?.client?.name || "Cliente General",
        cliente_rif: order?.client?.documento || "V-00000000",
        tasa_cambio: rate,
        detalles: (order?.medications ?? []).map((m) => ({
          producto_id: m.barCode,
          descripcion: m.name,
          cantidad: m.quantity,
          precio_unitario_ves: m.price / (1 + (m.vat || 0) / 100),
          iva_porcentaje: m.vat || 0,
        })),
        movimiento_caja: {
          moneda: selectedPaymentMethod === "dolares" ? "USD" : "VES",
          monto_original: payment.amount,
          tasa_cambio: selectedPaymentMethod === "dolares" ? rate : undefined,
          metodo_pago:
            selectedPaymentMethod === "efectivo"
              ? "Efectivo"
              : selectedPaymentMethod === "dolares"
                ? "Efectivo"
                : selectedPaymentMethod === "tarjeta"
                  ? "TarjetaDebito"
                  : "Transferencia",
          descripcion: `Cobro factura ${controlNumber}`,
        },
      });

      onComplete();
    } catch {
      // error handled by store
    }
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800">Procesar Pago</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiX size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Método de Pago
            </p>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(PAYMENT_ICONS) as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`px-4 py-3 rounded-2xl font-black text-sm transition-all ${
                    selectedPaymentMethod === method
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {PAYMENT_ICONS[method]}{" "}
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </button>
              ))}
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              {selectedPaymentMethod === "efectivo" && (
                <PaymentField
                  label="Monto en Bs"
                  value={String((payments.efectivo as CashPayment).amount || "")}
                  onChange={(v) => {
                    const amt = parseFloat(v) || 0;
                    updatePayment({
                      amount: amt,
                      change: Math.max(0, amt - totals.total),
                    });
                  }}
                  placeholder="0.00"
                />
              )}
              {selectedPaymentMethod === "dolares" && (
                <PaymentField
                  label="Monto en USD"
                  value={String((payments.dolares as DollarPayment).amount || "")}
                  onChange={(v) => {
                    const amt = parseFloat(v) || 0;
                    updatePayment({
                      amount: amt,
                      change: Math.max(0, amt - totals.total / (rate || 300)),
                    });
                  }}
                  placeholder="0.00"
                />
              )}
              {selectedPaymentMethod === "tarjeta" && (
                <>
                  <PaymentField
                    label="Referencia"
                    value={(payments.tarjeta as CardPayment).reference}
                    onChange={(v) => updatePayment({ reference: v })}
                    placeholder="Número de referencia"
                  />
                  <select
                    value={(payments.tarjeta as CardPayment).cardType}
                    onChange={(e) => updatePayment({ cardType: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  >
                    <option value="">Tipo de tarjeta</option>
                    {CARD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {selectedPaymentMethod === "pagomovil" && (
                <>
                  <PaymentField
                    label="Referencia"
                    value={(payments.pagomovil as MobilePayment).reference}
                    onChange={(v) => updatePayment({ reference: v })}
                    placeholder="Número de referencia"
                  />
                  <select
                    value={(payments.pagomovil as MobilePayment).bank}
                    onChange={(e) => updatePayment({ bank: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  >
                    <option value="">Banco</option>
                    {VENEZUELAN_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {selectedPaymentMethod === "biopago" && (
                <>
                  <PaymentField
                    label="Referencia"
                    value={(payments.biopago as BiopagoPayment).reference}
                    onChange={(v) => updatePayment({ reference: v })}
                    placeholder="Número de referencia"
                  />
                  <select
                    value={(payments.biopago as BiopagoPayment).bank}
                    onChange={(e) => updatePayment({ bank: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  >
                    <option value="">Banco</option>
                    {VENEZUELAN_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {(payments.efectivo as CashPayment).change > 0 && (
              <div className="bg-green-50 rounded-2xl p-3 text-center">
                <span className="text-xs font-bold text-green-600">Cambio: </span>
                <span className="text-lg font-black text-green-700">
                  {formatPrice((payments.efectivo as CashPayment).change)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Resumen Fiscal
            </p>
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">Monto base:</span>
                <span className="font-black text-slate-700">{formatPrice(baseAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">IVA:</span>
                <span className="font-black text-slate-700">{formatPrice(totals.totalVat)}</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">Total:</span>
                <span className="text-xl font-black text-blue-600">
                  {formatPrice(totals.total)}
                </span>
              </div>
              {igtf > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-amber-600">IGTF 3%:</span>
                  <span className="font-black text-amber-600">{formatPrice(igtf)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">Total a cobrar:</span>
                <span className="text-lg font-black text-slate-800">
                  {formatPrice(totals.total + igtf)}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-center">
              <svg className="w-32 h-24 text-slate-200" viewBox="0 0 200 150" fill="none">
                <rect x="10" y="10" width="180" height="130" rx="8" stroke="currentColor" strokeWidth="2" />
                <line x1="30" y1="40" x2="170" y2="40" stroke="currentColor" strokeWidth="1" />
                <line x1="30" y1="55" x2="120" y2="55" stroke="currentColor" strokeWidth="1" />
                <line x1="30" y1="70" x2="100" y2="70" stroke="currentColor" strokeWidth="1" />
                <line x1="30" y1="85" x2="140" y2="85" stroke="currentColor" strokeWidth="1" />
                <rect x="130" y="95" width="40" height="25" rx="4" stroke="currentColor" strokeWidth="1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handlePaymentSubmit}
            disabled={isProcessing || !activeSession}
            className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "Procesando..." : "Cobrar e Imprimir"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}
