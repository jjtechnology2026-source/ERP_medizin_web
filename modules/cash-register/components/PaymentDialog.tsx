"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { HiX } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useProductsStore } from "@/modules/products/store/products.store";
import { customerService } from "@/modules/customers/api/customer.service";
import type {
  PaymentMethod,
  CashPayment,
  DollarPayment,
  CardPayment,
  MobilePayment,
  BiopagoPayment,
} from "@/modules/cash-register/types/cashier.types";

type ManualChangeType = "efectivoVes" | "efectivoUsd" | "movil" | "credito";

interface ManualChangeEntry {
  tipo: ManualChangeType;
  amount: number;
  bank: string;
  reference: string;
}

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

// Redondea a 2 decimales
const r2 = (n: number) => Math.round(n * 100) / 100;

const formatUsd = (n: number) => `$ ${r2(n).toFixed(2)}`;
const formatBs = (n: number, rate: number) => `Bs ${r2(n * rate).toFixed(2)}`;

export default function PaymentDialog({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const {
    getComputedTotals,
    activePaymentMethods,
    togglePaymentMethod,
    payments,
    setPayment,
  } = useCurrentOrderStore();
  const { registerSale, confirmFiscalControlNumber, activeSession, errorMessage, setError } = useCashierWorkflowStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const { profile } = useAuthStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [manualChanges, setManualChanges] = useState<ManualChangeEntry[]>([]);
  const [isAwaitingControlNumber, setIsAwaitingControlNumber] = useState(false);
  const [controlNumberInput, setControlNumberInput] = useState("");

  const totals = getComputedTotals();
  const rate = getEffectiveRate();

  const formatPrice = (amountInUsd: number) => {
    if (isDollar) return `$ ${r2(amountInUsd).toFixed(2)}`;
    return `Bs ${r2(amountInUsd * rate).toFixed(2)}`;
  };

  const totalVes = totals.total * rate;
  const igtfVes = activePaymentMethods.length === 1 && activePaymentMethods[0] === "dolares"
    ? r2(totalVes * 0.03)
    : 0;
  const totalConIgtfVes = r2(totalVes + igtfVes);

  const updatePayment = (method: PaymentMethod, partial: Record<string, any>) => {
    const base = payments[method];
    setPayment({ ...base, ...partial } as any);
  };

  const totalPaid = activePaymentMethods.reduce((sum, method) => {
    const p = payments[method];
    if (method === "dolares") return sum + (p.amount || 0) * rate;
    return sum + (p.amount || 0);
  }, 0);

  const remaining = Math.max(0, r2(totalConIgtfVes - totalPaid));
  const exceso = totalPaid > totalConIgtfVes ? r2(totalPaid - totalConIgtfVes) : 0;
  const VES_TOLERANCE = rate * 0.01;

  const totalCambioAsignado = manualChanges.reduce((sum, entry) => {
    if (entry.tipo === "efectivoVes") return sum + entry.amount;
    if (entry.tipo === "efectivoUsd") return sum + entry.amount * rate;
    if (entry.tipo === "movil") return sum + entry.amount * rate;
    if (entry.tipo === "credito") return sum + entry.amount * rate;
    return sum;
  }, 0);

  const cambioPendiente = r2(exceso - totalCambioAsignado);

  const hasInvalidActiveMethod = activePaymentMethods.some((method) => {
    const p = payments[method];
    if (!p || p.amount <= 0) return true;
    if (method === "tarjeta") {
      const card = p as CardPayment;
      if (!card.reference.trim() || !card.cardType) return true;
    }
    if (method === "pagomovil") {
      const mobile = p as MobilePayment;
      if (!mobile.reference.trim() || !mobile.bank) return true;
    }
    if (method === "biopago") {
      const biopago = p as BiopagoPayment;
      if (!biopago.reference.trim() || !biopago.bank) return true;
    }
    return false;
  });

  const addManualChange = () => {
    setManualChanges((prev) => [
      ...prev,
      { tipo: "efectivoVes", amount: 0, bank: "", reference: "" },
    ]);
  };

  const updateManualChange = (index: number, partial: Partial<ManualChangeEntry>) => {
    setManualChanges((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        const updated = { ...entry, ...partial };
        const otherTotal = prev.reduce((sum, e, idx) => {
          if (idx === index) return sum;
          if (e.tipo === "efectivoVes") return sum + e.amount;
          if (e.tipo === "efectivoUsd") return sum + e.amount * rate;
          if (e.tipo === "movil") return sum + e.amount * rate;
          if (e.tipo === "credito") return sum + e.amount * rate;
          return sum;
        }, 0);
        const maxForThis = Math.max(0, r2(exceso - otherTotal));
        let maxInUnit = maxForThis;
        if (updated.tipo === "efectivoUsd" || updated.tipo === "movil" || updated.tipo === "credito") {
          maxInUnit = r2(maxForThis / (rate || 300));
        }
        if (updated.amount > maxInUnit) updated.amount = r2(maxInUnit);
        return updated;
      })
    );
  };

  const removeManualChange = (index: number) => {
    setManualChanges((prev) => prev.filter((_, i) => i !== index));
  };

  const validatePayments = (): string | null => {
    if (activePaymentMethods.length === 0) return "Seleccione al menos un método de pago.";

    for (const method of activePaymentMethods) {
      const p = payments[method];
      if (!p || p.amount <= 0) return `Ingrese un monto mayor a 0 para ${method}.`;

      if (method === "tarjeta") {
        const card = p as CardPayment;
        if (!card.reference.trim()) return "Falta la referencia de la tarjeta.";
        if (!card.cardType) return "Seleccione el tipo de tarjeta.";
      }
      if (method === "pagomovil") {
        const mobile = p as MobilePayment;
        if (!mobile.reference.trim()) return "Falta la referencia del pago móvil.";
        if (!mobile.bank) return "Seleccione el banco para el pago móvil.";
      }
      if (method === "biopago") {
        const biopago = p as BiopagoPayment;
        if (!biopago.reference.trim()) return "Falta la referencia del biopago.";
        if (!biopago.bank) return "Seleccione el banco para el biopago.";
      }
    }

    if (exceso > VES_TOLERANCE) {
      if (manualChanges.length === 0) return "Debe asignar el cambio manualmente.";

      for (const entry of manualChanges) {
        if (entry.amount <= 0) return "Cada cambio manual debe tener un monto > 0.";
        if (entry.tipo === "movil") {
          if (!entry.bank.trim()) return "Seleccione el banco para el cambio móvil.";
          if (!entry.reference.trim()) return "Falta la referencia del cambio móvil.";
        }
      }

      if (Math.abs(cambioPendiente) > VES_TOLERANCE) {
        const msg = cambioPendiente > 0
          ? `Falta asignar ${formatPrice(cambioPendiente / rate)} de cambio.`
          : `Sobran ${formatPrice(Math.abs(cambioPendiente) / rate)} en el cambio.`;
        return msg;
      }
    }

    return null;
  };

  const handlePaymentSubmit = async () => {
    setLocalError(null);
    setError(null);

    if (!activeSession) {
      setLocalError("No hay sesión de caja activa.");
      return;
    }
    if (activeSession.approvalStatus !== "approved") {
      setLocalError(
        activeSession.approvalStatus === "pending"
          ? "La apertura de caja aún no fue aprobada."
          : "La sesión de caja no está aprobada."
      );
      return;
    }
    if (remaining > VES_TOLERANCE) {
      setLocalError(`Falta cubrir ${formatPrice(remaining / rate)}`);
      return;
    }

    const paymentError = validatePayments();
    if (paymentError) {
      setLocalError(paymentError);
      return;
    }

    setIsProcessing(true);
    try {
      const order = useCurrentOrderStore.getState().getCurrentOrder();
      const clientData = order?.client;
      const isFound = (clientData as any)?.found === "true";

      if (!isFound && clientData?.documento) {
        try {
          await customerService.create({
            documento: clientData.documento,
            name: clientData.name || "Cliente General",
            email: clientData.email || "",
            phone: clientData.phone || "",
            direccion: clientData.direccion || "",
            retencion: clientData.retencion || "0",
            tipo_documento: (clientData as any)?.tipo_documento || "V",
          });
        } catch { /* no detener venta */ }
      }

      console.log("📤 [PaymentDialog] Enviando orden...");

      const result = await registerSale(
        (profile as any)?.usesDigitalBilling ? "digital" : "local"
      );

      if (!result) {
        throw new Error("No se pudo procesar la venta");
      }

      if (result.pendingControlNumber) {
        setIsAwaitingControlNumber(true);
        setControlNumberInput("");
        setIsProcessing(false);
        return;
      }

      if (result.facturacion?.success) {
        console.log("✅ Factura fiscal:", result.facturacion.numeroControl);
      }

      const soldMeds = order?.medications ?? [];
      if (soldMeds.length > 0) {
        useProductsStore.getState().decrementStock(
          soldMeds.map((med) => ({ barCode: med.barCode, quantity: med.quantity }))
        );
      }
      useCurrentOrderStore.getState().clearCurrentOrder();
      onComplete();
    } catch (error: any) {
      const mensajeBackend =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Error al emitir factura";

      setLocalError(mensajeBackend);
      setError(mensajeBackend);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleControlNumberConfirm = async () => {
    if (!controlNumberInput.trim()) return;
    setIsProcessing(true);
    try {
      await confirmFiscalControlNumber(controlNumberInput.trim());
      const order = useCurrentOrderStore.getState().getCurrentOrder();
      const soldMeds = order?.medications ?? [];
      if (soldMeds.length > 0) {
        useProductsStore.getState().decrementStock(
          soldMeds.map((med) => ({ barCode: med.barCode, quantity: med.quantity }))
        );
      }
      useCurrentOrderStore.getState().clearCurrentOrder();
      onComplete();
    } catch (err: any) {
      setLocalError(err.message || "Error al registrar la orden");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
    {createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-md">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col text-slate-800">
        <div className="flex items-center justify-between p-6 pb-3 flex-shrink-0">
          <h2 className="text-xl font-black text-slate-800">Procesar Pago</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiX size={20} />
          </button>
        </div>

        {(localError || errorMessage) && (
          <div className="px-6 pb-3 flex-shrink-0">
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
              {localError || errorMessage}
            </div>
          </div>
        )}

        <div className="px-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-6">
            <div className="lg:col-span-2 space-y-5">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                Métodos de Pago
              </p>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(PAYMENT_ICONS) as PaymentMethod[]).map((method) => (
                  <label
                    key={method}
                    className={`flex items-center gap-1 px-4 py-3 rounded-2xl font-black text-sm cursor-pointer transition-all ${
                      activePaymentMethods.includes(method)
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <input type="checkbox" checked={activePaymentMethods.includes(method)} onChange={() => togglePaymentMethod(method)} className="sr-only" />
                    {PAYMENT_ICONS[method]} {method.charAt(0).toUpperCase() + method.slice(1)}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePaymentMethods.map((method) => (
                  <div key={method} className="bg-slate-50 rounded-2xl p-5 space-y-3">
                    <p className="text-sm font-black text-slate-600">{method.charAt(0).toUpperCase() + method.slice(1)}</p>
                    {method === "efectivo" && (
                      <PaymentField
                        label="Monto en Bs"
                        value={String((payments.efectivo as CashPayment).amount || "")}
                        onChange={(v) => {
                          const amt = r2(parseFloat(v) || 0);
                          updatePayment("efectivo", { amount: amt, change: r2(Math.max(0, amt - totalConIgtfVes)) });
                        }}
                        placeholder="0.00"
                        fullAmount={totalConIgtfVes}
                        rate={rate}
                      />
                    )}
                    {method === "dolares" && (
                      <PaymentField
                        label="Monto en USD"
                        value={String((payments.dolares as DollarPayment).amount || "")}
                        onChange={(v) => {
                          const amt = r2(parseFloat(v) || 0);
                          updatePayment("dolares", { amount: amt, change: 0 });
                        }}
                        placeholder="0.00"
                        fullAmount={totalConIgtfVes / rate}
                      />
                    )}
                    {method === "tarjeta" && (
                      <>
                        <PaymentField label="Monto en Bs" value={String((payments.tarjeta as CardPayment).amount || "")} onChange={(v) => updatePayment("tarjeta", { amount: r2(parseFloat(v) || 0) })} placeholder="0.00" fullAmount={totalConIgtfVes} rate={rate} />
                        <PaymentField label="Referencia" value={(payments.tarjeta as CardPayment).reference} onChange={(v) => updatePayment("tarjeta", { reference: v })} placeholder="Número de referencia" />
                        <select
                          value={(payments.tarjeta as CardPayment).cardType}
                          onChange={(e) => updatePayment("tarjeta", { cardType: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none"
                        >
                          <option value="">Tipo de tarjeta</option>
                          {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </>
                    )}
                    {method === "pagomovil" && (
                      <>
                        <PaymentField label="Monto en Bs" value={String((payments.pagomovil as MobilePayment).amount || "")} onChange={(v) => updatePayment("pagomovil", { amount: r2(parseFloat(v) || 0) })} placeholder="0.00" fullAmount={totalConIgtfVes} rate={rate} />
                        <PaymentField label="Referencia" value={(payments.pagomovil as MobilePayment).reference} onChange={(v) => updatePayment("pagomovil", { reference: v })} placeholder="Número de referencia" />
                        <select
                          value={(payments.pagomovil as MobilePayment).bank}
                          onChange={(e) => updatePayment("pagomovil", { bank: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none"
                        >
                          <option value="">Banco</option>
                          {VENEZUELAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </>
                    )}
                    {method === "biopago" && (
                      <>
                        <PaymentField label="Monto en Bs" value={String((payments.biopago as BiopagoPayment).amount || "")} onChange={(v) => updatePayment("biopago", { amount: r2(parseFloat(v) || 0) })} placeholder="0.00" fullAmount={totalConIgtfVes} rate={rate} />
                        <PaymentField label="Referencia" value={(payments.biopago as BiopagoPayment).reference} onChange={(v) => updatePayment("biopago", { reference: v })} placeholder="Número de referencia" />
                        <select
                          value={(payments.biopago as BiopagoPayment).bank}
                          onChange={(e) => updatePayment("biopago", { bank: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none"
                        >
                          <option value="">Banco</option>
                          {VENEZUELAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {exceso > VES_TOLERANCE && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-700">Asignar cambio (manual)</h3>
                    <span className="text-xs font-bold text-slate-500">
                      Pendiente: {formatPrice(Math.max(0, cambioPendiente) / rate)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Reparte el vuelto. Usa <strong>Completar cambio</strong> para asignarlo automáticamente en efectivo Bs.
                  </p>
                  {manualChanges.map((entry, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <select
                          value={entry.tipo}
                          onChange={(e) => updateManualChange(idx, { tipo: e.target.value as ManualChangeType })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
                        >
                          <option value="efectivoVes">Efectivo Bs</option>
                          <option value="efectivoUsd">Efectivo USD</option>
                          <option value="movil">Pago móvil</option>
                          <option value="credito">Crédito</option>
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          value={entry.amount || ""}
                          onChange={(e) => updateManualChange(idx, { amount: r2(parseFloat(e.target.value) || 0) })}
                          placeholder="0.00"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
                        />
                      </div>
                      {entry.tipo === "movil" && (
                        <>
                          <div className="col-span-2">
                            <select
                              value={entry.bank}
                              onChange={(e) => updateManualChange(idx, { bank: e.target.value })}
                              className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
                            >
                              <option value="">Banco</option>
                              {VENEZUELAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={entry.reference}
                              onChange={(e) => updateManualChange(idx, { reference: e.target.value })}
                              placeholder="Ref"
                              className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
                            />
                          </div>
                        </>
                      )}
                      <div className="col-span-1">
                        <button onClick={() => removeManualChange(idx)} className="text-red-500 hover:text-red-700 text-lg font-bold">✕</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <button onClick={addManualChange} className="text-xs font-bold text-blue-600 hover:underline">
                      + Agregar otro cambio
                    </button>
                    {cambioPendiente > VES_TOLERANCE && (
                      <button
                        onClick={() =>
                          setManualChanges((prev) => [
                            ...prev,
                            { tipo: "efectivoVes", amount: cambioPendiente, bank: "", reference: "" },
                          ])
                        }
                        className="text-xs font-bold text-emerald-600 hover:underline"
                      >
                        Completar cambio
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Resumen Fiscal</p>
              <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                <SummaryRow label="Base imponible:" usd={totals.taxableBase} rate={rate} />
                {Object.entries(totals.vatByRate)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([vat, amount]) => (
                    <SummaryRow key={vat} label={`IVA ${vat}%:`} usd={amount} rate={rate} />
                  ))}
                {totals.exemptTotal > 0 && (
                  <SummaryRow label="Monto exento:" usd={totals.exemptTotal} rate={rate} />
                )}
                <div className="h-px bg-slate-200" />
                <SummaryRow label="Total:" usd={totals.total} rate={rate} bold highlight />
                {igtfVes > 0 && (
                  <SummaryRow label="IGTF 3%:" usd={igtfVes / rate} rate={rate} amber />
                )}
                <SummaryRow label="Total a cobrar:" usd={totalConIgtfVes / rate} rate={rate} large />
                <SummaryRow label="Total cubierto:" usd={totalPaid / rate} rate={rate} large color={totalPaid >= totalConIgtfVes ? 'green' : 'red'} />
                {remaining > 0 && (
                  <SummaryRow label="Pendiente:" usd={remaining / rate} rate={rate} large color="red" />
                )}
                {exceso > VES_TOLERANCE && (
                  <SummaryRow label="Vuelto:" usd={exceso / rate} rate={rate} large color="amber" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 p-6 pt-0">
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button onClick={onClose} className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
              Cancelar
            </button>
            <button
              onClick={handlePaymentSubmit}
              disabled={
                isProcessing ||
                !activeSession ||
                activeSession.approvalStatus !== "approved" ||
                remaining > VES_TOLERANCE ||
                hasInvalidActiveMethod ||
                (exceso > VES_TOLERANCE && Math.abs(cambioPendiente) > VES_TOLERANCE)
              }
              className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? "Procesando..."
                : !activeSession
                  ? "Sin sesión activa"
                  : activeSession.approvalStatus !== "approved"
                    ? "Sesión no aprobada"
                    : remaining > VES_TOLERANCE
                      ? `Falta ${formatPrice(remaining / rate)}`
                      : hasInvalidActiveMethod
                        ? "Complete los métodos de pago"
                        : exceso > VES_TOLERANCE && Math.abs(cambioPendiente) > VES_TOLERANCE
                          ? "Asigne el cambio"
                          : "Cobrar e Imprimir"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
    )}
    {isAwaitingControlNumber && (
      <ControlNumberDialog
        controlNumber={controlNumberInput}
        onChange={setControlNumberInput}
        onConfirm={handleControlNumberConfirm}
        onCancel={() => {
          setIsAwaitingControlNumber(false);
          setControlNumberInput("");
          setLocalError("Venta cancelada — la factura fiscal ya fue impresa pero no se registró en el sistema.");
        }}
        isProcessing={isProcessing}
      />
    )}
    </>
  );
}

function ControlNumberDialog({
  controlNumber,
  onChange,
  onConfirm,
  onCancel,
  isProcessing,
}: {
  controlNumber: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-md">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md mx-4 p-8 flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-800">Número de control interno</h2>
          <p className="text-sm font-bold text-slate-400 mt-1">
            Ingresá el número de control que aparece en el ticket fiscal impreso
          </p>
        </div>

        <input
          type="text"
          value={controlNumber}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej: 00000123"
          className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 text-center text-lg tracking-widest"
          autoFocus
        />

        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
            Registrando venta...
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!controlNumber.trim() || isProcessing}
            className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SummaryRow({ label, usd, rate, bold, highlight, amber, large, color }: {
  label: string;
  usd: number;
  rate: number;
  bold?: boolean;
  highlight?: boolean;
  amber?: boolean;
  large?: boolean;
  color?: 'green' | 'red' | 'amber';
}) {
  const primaryClass = large ? 'text-lg' : 'text-sm';
  const colorClass = color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-500' : color === 'amber' ? 'text-amber-600' : highlight ? 'text-blue-600' : amber ? 'text-amber-600' : 'text-slate-700';
  return (
    <div className="flex justify-between items-start">
      <span className="font-bold text-slate-500 text-sm">{label}</span>
      <div className="text-right">
        <span className={`${primaryClass} font-black ${colorClass} leading-tight`}>
          {formatUsd(usd)}
        </span>
        <br />
        <span className="text-[10px] font-bold text-slate-400 leading-tight">
          {formatBs(usd, rate)}
        </span>
      </div>
    </div>
  );
}

function PaymentField({ label, value, onChange, placeholder, fullAmount, rate }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; fullAmount?: number; rate?: number }) {
  const numVal = parseFloat(value) || 0;
  const showUsd = rate && rate > 1 && numVal > 0 && label.includes("Bs");
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-600 mb-1 block">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {fullAmount !== undefined && fullAmount > 0 && (
          <button
            type="button"
            onClick={() => onChange(String(r2(fullAmount)))}
            className="px-3 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-all whitespace-nowrap"
            title="Pago completo"
          >
            Total
          </button>
        )}
      </div>
      {showUsd && (
        <span className="text-[10px] text-slate-400 font-medium mt-1 block">
          ≈ $ {(numVal / rate).toFixed(2)}
        </span>
      )}
    </div>
  );
}
