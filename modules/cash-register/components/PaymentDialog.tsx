"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { HiX } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
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
    getPaymentsForInvoice,
  } = useCurrentOrderStore();
  const { registerSale, activeSession, errorMessage, setError } = useCashierWorkflowStore();
  const { getEffectiveRate } = useCurrencyStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [manualChanges, setManualChanges] = useState<ManualChangeEntry[]>([]);

  const totals = getComputedTotals();
  const rate = getEffectiveRate();

  const formatPrice = (amount: number) => `Bs ${r2(amount * rate).toFixed(2)}`;

  const baseAmount = totals.total - totals.totalVat;

  const igtf = activePaymentMethods.length === 1 && activePaymentMethods[0] === "dolares"
    ? r2(totals.total * 0.03)
    : 0;
  const totalConIgtf = r2(totals.total + igtf);

  const updatePayment = (method: PaymentMethod, partial: Record<string, any>) => {
    const base = payments[method];
    setPayment({ ...base, ...partial } as any);
  };

  const totalPaid = activePaymentMethods.reduce((sum, method) => {
    const p = payments[method];
    if (method === "dolares") return sum + (p.amount || 0) * rate;
    return sum + (p.amount || 0);
  }, 0);

  const remaining = Math.max(0, r2(totalConIgtf - totalPaid));
  const exceso = totalPaid > totalConIgtf ? r2(totalPaid - totalConIgtf) : 0;

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

    if (exceso > 0.01) {
      if (manualChanges.length === 0) return "Debe asignar el cambio manualmente.";

      for (const entry of manualChanges) {
        if (entry.amount <= 0) return "Cada cambio manual debe tener un monto > 0.";
        if (entry.tipo === "movil") {
          if (!entry.bank.trim()) return "Seleccione el banco para el cambio móvil.";
          if (!entry.reference.trim()) return "Falta la referencia del cambio móvil.";
        }
      }

      if (Math.abs(cambioPendiente) > 0.01) {
        const msg = cambioPendiente > 0
          ? `Falta asignar ${formatPrice(cambioPendiente)} de cambio.`
          : `Sobran ${formatPrice(Math.abs(cambioPendiente))} en el cambio.`;
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
    if (remaining > 0.01) {
      setLocalError(`Falta cubrir ${formatPrice(remaining)}`);
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
          });
        } catch { /* no detener venta */ }
      }

      const controlNumber = `FAC-${Date.now()}`;
      const invoicePayments = getPaymentsForInvoice();

      // Calcular detalles con precios redondeados a 2 decimales
      const detalles = (order?.medications ?? []).map((m) => {
        const unitPrice = r2(m.price / (1 + (m.vat || 0) / 100));
        const lineTotal = r2(unitPrice * m.quantity * (1 + (m.vat || 0) / 100));
        return {
          producto_id: m.barCode,
          descripcion: m.name,
          cantidad: m.quantity,
          precio_unitario_ves: unitPrice,
          iva_porcentaje: m.vat || 0,
          lineTotal, // solo para cálculo interno
        };
      });

      // Total real de la factura (suma de líneas redondeadas)
      const totalFactura = r2(detalles.reduce((sum, d) => sum + d.lineTotal, 0));

      let movimientoCaja: any;
      if (invoicePayments.length === 1) {
        const p = invoicePayments[0];
        const esDolar = p.type === "dolares";
        movimientoCaja = {
          moneda: esDolar ? "USD" : "VES",
          monto_original: esDolar ? r2(p.amount) : totalFactura,
          metodo_pago: esDolar ? "Efectivo" : p.type === "efectivo" ? "Efectivo" : p.type === "tarjeta" ? "TarjetaDebito" : "Transferencia",
          descripcion: `Cobro factura ${controlNumber}`,
        };
        if (esDolar) movimientoCaja.tasa_cambio = rate;
      } else {
        const principal = invoicePayments.reduce((prev, curr) => {
          const prevMonto = prev.type === "dolares" ? prev.amount * rate : prev.amount;
          const currMonto = curr.type === "dolares" ? curr.amount * rate : curr.amount;
          return currMonto > prevMonto ? curr : prev;
        });
        const detalle = invoicePayments
          .map((p) => `${p.type} ${r2(p.amount).toFixed(2)} ${p.type === "dolares" ? "USD" : "VES"}`)
          .join(", ");
        movimientoCaja = {
          moneda: "VES",
          monto_original: totalFactura,
          metodo_pago: principal.type === "efectivo" ? "Efectivo" : principal.type === "dolares" ? "Efectivo" : principal.type === "tarjeta" ? "TarjetaDebito" : "Transferencia",
          descripcion: `Cobro factura ${controlNumber} | Pago mixto: ${detalle}`,
        };
      }

      const payload = {
        sesion_caja_id: activeSession.id,
        numero_control: controlNumber,
        cliente_nombre: clientData?.name || "Cliente General",
        cliente_rif: clientData?.documento || "V-00000000",
        tasa_cambio: rate,
        detalles: detalles.map((d) => ({
          producto_id: d.producto_id,
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precio_unitario_ves: d.precio_unitario_ves,
          iva_porcentaje: d.iva_porcentaje,
        })),
        movimiento_caja: movimientoCaja,
      };

      console.log("📤 [PaymentDialog] Enviando payload:", JSON.stringify(payload, null, 2));

      await registerSale(payload);

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

  return createPortal(
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
                          updatePayment("efectivo", { amount: amt, change: r2(Math.max(0, amt - totalConIgtf)) });
                        }}
                        placeholder="0.00"
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
                      />
                    )}
                    {method === "tarjeta" && (
                      <>
                        <PaymentField label="Monto en Bs" value={String((payments.tarjeta as CardPayment).amount || "")} onChange={(v) => updatePayment("tarjeta", { amount: r2(parseFloat(v) || 0) })} placeholder="0.00" />
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
                        <PaymentField label="Monto en Bs" value={String((payments.pagomovil as MobilePayment).amount || "")} onChange={(v) => updatePayment("pagomovil", { amount: r2(parseFloat(v) || 0) })} placeholder="0.00" />
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
                        <PaymentField label="Monto en Bs" value={String((payments.biopago as BiopagoPayment).amount || "")} onChange={(v) => updatePayment("biopago", { amount: r2(parseFloat(v) || 0) })} placeholder="0.00" />
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

              {exceso > 0.01 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-700">Asignar cambio (manual)</h3>
                    <span className="text-xs font-bold text-slate-500">
                      Pendiente: {formatPrice(Math.max(0, cambioPendiente))}
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
                    {cambioPendiente > 0.01 && (
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
              <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
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
                  <span className="text-xl font-black text-blue-600">{formatPrice(totals.total)}</span>
                </div>
                {igtf > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-amber-600">IGTF 3%:</span>
                    <span className="font-black text-amber-600">{formatPrice(igtf)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-500">Total a cobrar:</span>
                  <span className="text-lg font-black text-slate-800">{formatPrice(totalConIgtf)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-500">Total cubierto:</span>
                  <span className={`text-lg font-black ${totalPaid >= totalConIgtf ? 'text-green-600' : 'text-red-500'}`}>{formatPrice(totalPaid)}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-red-500">Pendiente:</span>
                    <span className="text-lg font-black text-red-500">{formatPrice(remaining)}</span>
                  </div>
                )}
                {exceso > 0.01 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-amber-600">Vuelto:</span>
                    <span className="text-lg font-black text-amber-600">{formatPrice(exceso)}</span>
                  </div>
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
                remaining > 0.01 ||
                hasInvalidActiveMethod ||
                (exceso > 0.01 && Math.abs(cambioPendiente) > 0.01)
              }
              className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? "Procesando..."
                : !activeSession
                  ? "Sin sesión activa"
                  : activeSession.approvalStatus !== "approved"
                    ? "Sesión no aprobada"
                    : remaining > 0.01
                      ? `Falta ${formatPrice(remaining)}`
                      : hasInvalidActiveMethod
                        ? "Complete los métodos de pago"
                        : exceso > 0.01 && Math.abs(cambioPendiente) > 0.01
                          ? "Asigne el cambio"
                          : "Cobrar e Imprimir"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PaymentField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-600 mb-1 block">{label}</label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}