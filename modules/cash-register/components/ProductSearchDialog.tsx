"use client";
import { useEffect, useRef, useState } from "react";
import { useProductsStore } from "@/modules/products/store/products.store";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { HiX, HiSearch } from "react-icons/hi";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { Medication } from "@/modules/products/types/products.types";

const STOCK_FILTERS: { label: string; value: "in" | "out" | null }[] = [
  { label: "Todos", value: null },
  { label: "Con stock", value: "in" },
  { label: "Sin stock", value: "out" },
];

// Margen de anticipación para empezar a traer la siguiente sección antes de que
// el usuario llegue al borde: la lista crece sin pausa perceptible.
const LOAD_AHEAD_PX = 200;

export default function ProductSearchDialog({ onClose }: { onClose: () => void }) {
  const { searchFeed, searchFeedLoad, searchFeedNext, searchFeedReset } = useProductsStore();
  const { items, hasMore, isLoading, isLoadingMore, error, nextCursor } = searchFeed;

  const { addMedication } = useCurrentOrderStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const [query, setQuery] = useState("");
  // Estado local, no el `stockFilter` del store: ese es compartido con el módulo
  // Productos y la modal no debe alterarlo.
  const [stockFilter, setStockFilter] = useState<"in" | "out" | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLTableDataCellElement>(null);

  // Busqueda server-side con debounce (dispara tambien la primera seccion al abrir).
  useEffect(() => {
    const t = setTimeout(() => {
      void searchFeedLoad({ query, stockFilter });
    }, 300);
    return () => clearTimeout(t);
  }, [query, stockFilter, searchFeedLoad]);

  // Al cerrar se vacia el feed para no dejar resultados de esta busqueda colgados.
  useEffect(() => {
    return () => {
      searchFeedReset();
    };
  }, [searchFeedReset]);

  // Carga automatica de la siguiente seccion al llegar al final de lo cargado.
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        const { hasMore: more, isLoading: loading, isLoadingMore: loadingMore, nextCursor: cursor } =
          useProductsStore.getState().searchFeed;
        if (!more || loading || loadingMore || !cursor) return;
        void searchFeedNext();
      },
      { root, rootMargin: `${LOAD_AHEAD_PX}px` },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [searchFeedNext, items.length, hasMore, isLoading, isLoadingMore, nextCursor]);

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

          <div className="flex items-center gap-1.5 mt-3">
            {STOCK_FILTERS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setStockFilter(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
                  stockFilter === opt.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            error ? (
              <div className="py-12 flex flex-col items-center gap-2">
                <p className="text-sm font-bold text-red-500">{error}</p>
                <button
                  onClick={() => void searchFeedLoad({ query, stockFilter })}
                  className="px-4 py-1.5 bg-white border border-red-200 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-50 transition-all"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-sm font-bold text-slate-300">
                {isLoading ? "Buscando..." : query ? "Sin resultados" : "Escribe para buscar productos"}
              </div>
            )
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
                {items.map((med, i) => (
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

                {isLoadingMore && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center">
                      <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-blue-500" />
                    </td>
                  </tr>
                )}

                {error && (
                  <tr>
                    <td colSpan={4} className="py-4">
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-red-500">
                        <span>{error}</span>
                        <button
                          onClick={() => void searchFeedNext()}
                          className="px-3 py-1.5 bg-white border border-red-200 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-50 transition-all"
                        >
                          Reintentar
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Sentinel: al entrar en viewport pide la siguiente seccion. */}
                <tr>
                  <td colSpan={4} ref={sentinelRef} className="h-px p-0" aria-hidden />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
