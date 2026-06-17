"use client";
import { useState } from "react";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

export default function OrderItemsTable() {
  const { getCurrentOrder, updateQuantity, removeMedication } = useCurrentOrderStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const order = getCurrentOrder();
  const rate = getEffectiveRate();

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${price.toFixed(2)}`;
    return `Bs ${(price * (rate || 1)).toFixed(2)}`;
  };

  const handleDoubleClick = (index: number, currentQty: number) => {
    setEditingIndex(index);
    setEditValue(String(currentQty));
  };

  const handleQuantitySubmit = (index: number) => {
    const qty = parseInt(editValue, 10);
    if (!isNaN(qty) && qty > 0) {
      updateQuantity(index, qty);
    }
    setEditingIndex(null);
  };

  if (!order || order.medications.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-bold text-slate-300">Agrega productos a la orden</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Código de barra
            </th>
            <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Nombre del Producto
            </th>
            <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Precio de venta
            </th>
            <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Cantidad
            </th>
            <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Existencia
            </th>
            <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Total
            </th>
            <th className="pb-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {order.medications.map((med, i) => (
            <tr key={med.barCode + i} className="hover:bg-slate-50/50 transition-colors">
              <td className="py-3 pr-4 font-mono text-xs text-slate-500">{med.barCode}</td>
              <td className="py-3 pr-4">
                <p className="text-sm font-bold text-slate-700">{med.name}</p>
                <p className="text-[10px] text-slate-400">{med.brand}</p>
              </td>
              <td className="py-3 pr-4 font-bold text-xs text-slate-600">
                {formatPrice(med.price)}
              </td>
              <td className="py-3 pr-4">
                {editingIndex === i ? (
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleQuantitySubmit(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleQuantitySubmit(i);
                      if (e.key === "Escape") setEditingIndex(null);
                    }}
                    className="w-16 px-2 py-1 bg-white border border-blue-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />
                ) : (
                  <button
                    onDoubleClick={() => handleDoubleClick(i, med.quantity)}
                    className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    {med.quantity}
                  </button>
                )}
              </td>
              <td className="py-3 pr-4">
                <span
                  className={`text-xs font-bold ${
                    med.stock <= med.minimum ? "text-red-500" : "text-slate-500"
                  }`}
                >
                  {med.stock}
                </span>
              </td>
              <td className="py-3 pr-4 font-black text-sm text-slate-800">
                {formatPrice(med.price * med.quantity)}
              </td>
              <td className="py-3">
                <button
                  onClick={() => removeMedication(i)}
                  className="text-slate-300 hover:text-red-500 transition-colors text-xs font-bold"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
