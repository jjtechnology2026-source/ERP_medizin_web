"use client";
import { useEffect, useRef, useState } from "react";
import { useProductsStore } from "@/modules/products/store/products.store";
import { useInfiniteScroll } from "@/modules/products/lib/useInfiniteScroll";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { HiX, HiSearch } from "react-icons/hi";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { Medication } from "@/modules/products/types/products.types";

export default function ProductSearchDialog({ onClose }: { onClose: () => void }) {
  const {
    inventory,
    isLoading,
    isLoadingMore,
    hasMore,
    searchInventory,
    loadNextPage,
  } = useProductsStore();

  const { addMedication } = useCurrentOrderStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const [query, setQuery] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Busqueda server-side con debounce (dispara tambien la primera pagina al abrir).
  useEffect(() => {
    const t = setTimeout(() => {
      void searchInventory(query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, searchInventory]);

  // Prefetch progresivo sobre el scroll propio del dialogo.
  useInfiniteScroll(sentinelRef, {
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: () => {
      void loadNextPage();
    },
  });

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${price.toFixed(2)}`;
    return `Bs ${(price * rate).toFixed(2)}`;
  };

  const handleSelect = (med: Medication) => {
    addMedication(med, 1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-800">Buscar Productos</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <HiX size={20} />
            </button>
          </div>
          <div className="relative">
            <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, código, principio activo..."
              className="w-full pl-11 pr-4 py-3 bg-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {inventory.length === 0 && (isLoading || query.trim().length > 0) ? (
            <div className="py-12 text-center text-sm font-bold text-slate-300">
              {isLoading ? "Buscando..." : "Sin resultados"}
            </div>
          ) : inventory.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-slate-300">
              Escribe para buscar productos
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre</th>
                  <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Precio</th>
                  <th className="pb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Existencia</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {inventory.map((med, i) => (
                  <tr
                    key={med.barCode || i}
                    onClick={() => handleSelect(med)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <p className="text-sm font-bold text-slate-700">{med.name}</p>
                      <p className="text-[10px] text-slate-400">{med.barCode}</p>
                    </td>
                    <td className="py-3 pr-4 font-bold text-xs text-slate-600">
                      {med.discount ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 line-through">{formatPrice(med.price / (1 - med.discount / 100))}</span>
                          <span className="text-xs text-emerald-600">{formatPrice(med.price)} <span className="text-[9px] text-slate-400">(-{med.discount}%)</span></span>
                        </div>
                      ) : formatPrice(med.price)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-bold ${med.stock <= med.minimum ? "text-red-500" : "text-slate-500"}`}>
                        {med.stock}
                      </span>
                    </td>
                    <td className="py-3">
                      <button className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:scale-105 transition-all">
                        Agregar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div ref={sentinelRef} className="h-1 w-full" />
        </div>

        {isLoadingMore && (
          <div className="p-4 border-t border-slate-100 text-center">
            <span className="text-xs font-bold text-slate-400">Cargando más...</span>
          </div>
        )}
      </div>
    </div>
  );
}
