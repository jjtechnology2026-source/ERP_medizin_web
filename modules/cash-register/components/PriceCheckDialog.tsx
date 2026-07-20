"use client";
import { useState } from "react";
import { HiX, HiSearch } from "react-icons/hi";
import { useProductsStore } from "@/modules/products/store/products.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

export default function PriceCheckDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ name: string; price: number; discount?: number; stock: number } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { inventory } = useProductsStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const handleSearch = () => {
    const med = inventory.find(
      (m) => m.barCode === code.trim() || m.name.toLowerCase().includes(code.trim().toLowerCase())
    );
    if (med) {
      setResult({ name: med.name, price: med.price, discount: med.discount, stock: med.stock });
      setNotFound(false);
    } else {
      setResult(null);
      setNotFound(true);
    }
  };

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${price.toFixed(2)}`;
    return `Bs ${(price * rate).toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800">Consultar Precio</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiX size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Código o nombre"
            className="flex-1 px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
            autoFocus
          />
          <button
            onClick={handleSearch}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:scale-105 transition-all"
          >
            <HiSearch size={18} />
          </button>
        </div>

        {result && (
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            <p className="font-bold text-slate-700 text-sm">{result.name}</p>
            {result.discount ? (
              <>
              <div className="flex justify-between">
                <span className="text-xs font-bold text-slate-400">Precio original:</span>
                <span className="text-sm font-bold text-slate-400 line-through">{formatPrice(result.price / (1 - result.discount / 100))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-bold text-slate-400">Descuento:</span>
                <span className="text-sm font-bold text-amber-600">{result.discount}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-bold text-slate-400">Precio final:</span>
                <span className="text-lg font-black text-emerald-600">{formatPrice(result.price)}</span>
              </div>
              </>
            ) : (
            <div className="flex justify-between">
              <span className="text-xs font-bold text-slate-400">Precio:</span>
              <span className="text-lg font-black text-blue-600">{formatPrice(result.price)}</span>
            </div>
            )}
            <div className="flex justify-between">
              <span className="text-xs font-bold text-slate-400">Stock:</span>
              <span className="font-bold text-slate-600">{result.stock} u.</span>
            </div>
          </div>
        )}

        {notFound && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-600 text-center">
            Producto no encontrado
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
