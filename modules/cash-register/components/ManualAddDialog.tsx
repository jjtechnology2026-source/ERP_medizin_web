"use client";
import { useState } from "react";
import { HiX } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useProductsStore } from "@/modules/products/store/products.store";

export default function ManualAddDialog({ onClose }: { onClose: () => void }) {
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const { addMedication } = useCurrentOrderStore();
  const { inventory } = useProductsStore();

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const med = inventory.find((m) => m.barCode === barcode);
    if (med && parseInt(val) > med.stock) {
      setError(`Stock disponible: ${med.stock}`);
    } else {
      setError(null);
    }
  };

  const handleAdd = () => {
    if (!barcode.trim()) {
      setError("Ingresa un código de barra");
      return;
    }
    const med = inventory.find((m) => m.barCode === barcode);
    if (!med) {
      setError("Producto no encontrado");
      return;
    }
    const qty = parseInt(quantity) || 1;
    const result = addMedication(med, qty);
    if (result.success) {
      onClose();
    } else {
      setError(result.error ?? "Error al agregar producto");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800">Agregar Producto</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiX size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Código de Barra</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                setError(null);
              }}
              placeholder="Ingresa el código"
              className="w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Cantidad</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              min={1}
              className="w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] transition-all"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
