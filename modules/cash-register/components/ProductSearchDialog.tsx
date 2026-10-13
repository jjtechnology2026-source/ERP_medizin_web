"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useProductsStore } from "@/modules/products/store/products.store";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { HiX, HiSearch } from "react-icons/hi";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { Medication } from "@/modules/products/types/products.types";
import { productsService } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

const STOCK_FILTERS: { label: string; value: "in" | "out" | null }[] = [
  { label: "Todos", value: null },
  { label: "Con stock", value: "in" },
  { label: "Sin stock", value: "out" },
];

export default function ProductSearchDialog({ onClose }: { onClose: () => void }) {
  const { stockFilter, setStockFilter } = useProductsStore();

  const { addMedication } = useCurrentOrderStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const [query, setQuery] = useState("");
  const [inventory, setInventory] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const searchSeqRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${price.toFixed(2)}`;
    return `Bs ${(price * rate).toFixed(2)}`;
  };

  const performSearch = useCallback(
    async (text: string, append = false, cursor?: string | null) => {
      const q = text.trim();
      const seq = ++searchSeqRef.current;
      const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
      if (!pharmacyId) return;

      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setInventory([]);
        setNextCursor(null);
        setHasMore(false);
      }

      try {
        const res = await productsService.getCursorInventory(pharmacyId, {
          query: q || undefined,
          limit: 10,
          stockFilter: stockFilter ?? undefined,
          cursor: append && cursor ? cursor : undefined,
        });

        if (seq === searchSeqRef.current) {
          const meds = Array.isArray(res.medications) ? res.medications : [];
          setInventory((prev) => (append ? [...prev, ...meds] : meds));
          setNextCursor(res.next_cursor ?? null);
          setHasMore(!!res.has_more || !!res.next_cursor);
        }
      } catch (e) {
        // ignore
      } finally {
        if (seq === searchSeqRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
        if (append) {
          loadingMoreRef.current = false;
        }
      }
    },
    [stockFilter]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      void performSearch(query, false, null);
    }, 300);
    return () => clearTimeout(t);
  }, [query, stockFilter, performSearch]);

  useEffect(() => {
    return () => {
      setStockFilter(null);
    };
  }, [setStockFilter]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMoreRef.current || isLoadingMore || !hasMore || !nextCursor) return;
    const threshold = 40;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      void performSearch(query, true, nextCursor);
    }
  }, [query, hasMore, isLoadingMore, nextCursor, performSearch]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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
          {inventory.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-slate-300">
              {isLoading ? "Buscando..." : query ? "Sin resultados" : "Escribe para buscar productos"}
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
                    key={`${med.barCode || i}-${i}`}
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
          {isLoadingMore && (
            <div className="py-3 text-center text-xs font-bold text-slate-400">Cargando más...</div>
          )}
        </div>
      </div>
    </div>
  );
}
