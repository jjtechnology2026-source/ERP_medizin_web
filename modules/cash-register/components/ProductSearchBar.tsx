"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { HiQrcode } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useProductsStore } from "@/modules/products/store/products.store";
import { productsService } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { Medication } from "@/modules/products/types/products.types";

const STOCK_FILTERS: { label: string; value: "in" | "out" | null }[] = [
  { label: "Todos", value: null },
  { label: "Con stock", value: "in" },
  { label: "Sin stock", value: "out" },
];

export default function ProductSearchBar() {
  const [barcode, setBarcode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { addMedication } = useCurrentOrderStore();
  const { findInventoryItem } = useProductsStore();

  const [results, setResults] = useState<Medication[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<"in" | "out" | null>("in");

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const searchSeqRef = useRef(0);
  const loadMoreSeqRef = useRef(0);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef(false);

  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${price.toFixed(2)}`;
    return `Bs ${(price * rate).toFixed(2)}`;
  };

  const performSearch = useCallback(async (text: string, append = false, cursor?: string | null) => {
    const query = text.trim();
    if (!query) {
      setResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      setNextCursor(null);
      setHasMore(false);
      return;
    }
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      setNextCursor(null);
      setHasMore(false);
      return;
    }

    const seq = append ? ++loadMoreSeqRef.current : ++searchSeqRef.current;
    const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
    if (!pharmacyId) {
      if ((!append && seq === searchSeqRef.current) || (append && seq === loadMoreSeqRef.current)) {
        setResults([]);
        setIsSearching(false);
        setIsLoadingMore(false);
      }
      return;
    }

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsSearching(true);
      setResults([]);
      setNextCursor(null);
      setHasMore(false);
    }

    try {
      const res = await productsService.getCursorInventory(pharmacyId, {
        query,
        limit: 10,
        stockFilter: stockFilter ?? undefined,
        cursor: append ? cursor || undefined : undefined,
      });
      if ((!append && seq === searchSeqRef.current) || (append && seq === loadMoreSeqRef.current)) {
        const meds = Array.isArray(res.medications) ? res.medications : [];
        setResults((prev) => (append ? [...prev, ...meds] : meds));
        setNextCursor(res.next_cursor ?? null);
        setHasMore(!!res.has_more || !!res.next_cursor);
      }
    } catch (e: any) {
      if ((!append && seq === searchSeqRef.current) || (append && seq === loadMoreSeqRef.current)) {
        setError(e?.message || "Error al buscar productos");
        if (!append) setResults([]);
      }
    } finally {
      if ((!append && seq === searchSeqRef.current) || (append && seq === loadMoreSeqRef.current)) {
        setIsSearching(false);
        setIsLoadingMore(false);
      }
    }
  }, [stockFilter]);

  useEffect(() => {
    const text = barcode.trim();
    setError(null);
    if (!text || text.length < 2) {
      setResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      setNextCursor(null);
      setHasMore(false);
      return;
    }
    setShowDropdown(true);
    const timer = setTimeout(() => {
      performSearch(text, false, null);
    }, 250);
    return () => clearTimeout(timer);
  }, [barcode, stockFilter, performSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || fetchingRef.current || isLoadingMore || !hasMore || !nextCursor) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      fetchingRef.current = true;
      performSearch(barcode.trim(), true, nextCursor).finally(() => {
        fetchingRef.current = false;
      });
    }
  }, [barcode, hasMore, isLoadingMore, nextCursor, performSearch]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, showDropdown]);

  const handleSelect = (med: Medication) => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    handleAdd(med);
  };

  const handleAdd = async (med?: Medication | null) => {
    const code = med?.barCode || barcode.trim();
    if (!code) return;
    let product = med;
    if (!product) {
      product = await findInventoryItem(code);
    }
    if (!product) {
      setBarcode("");
      setResults([]);
      setShowDropdown(false);
      setNextCursor(null);
      setHasMore(false);
      return;
    }
    const result = addMedication(product, 1);
    if (!result.success) {
      setError(result.error ?? "No se pudo agregar el producto");
      return;
    }
    setError(null);
    setBarcode("");
    setResults([]);
    setShowDropdown(false);
    setNextCursor(null);
    setHasMore(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) {
        handleAdd(results[0]);
      } else {
        handleAdd();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col md:flex-row md:items-center gap-3 w-full relative">
      <label className="text-xs font-black text-slate-600 whitespace-nowrap min-w-[130px] md:text-left">
        Código del Producto:
      </label>
      <div className="flex flex-1 gap-3 w-full">
        <div className="relative flex-1">
          <HiQrcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (blurTimerRef.current) {
                clearTimeout(blurTimerRef.current);
                blurTimerRef.current = null;
              }
              if (barcode.trim().length >= 2) {
                setShowDropdown(true);
              }
            }}
            onBlur={() => {
              blurTimerRef.current = setTimeout(() => {
                blurTimerRef.current = null;
                setShowDropdown(false);
              }, 150);
            }}
            placeholder="Código del producto o nombre del producto"
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400"
            autoFocus
          />
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50/70">
                {STOCK_FILTERS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setStockFilter(opt.value)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                      stockFilter === opt.value
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto overscroll-y-contain">
                {isSearching && results.length === 0 && (
                  <div className="px-4 py-3 text-xs font-bold text-slate-400">Buscando...</div>
                )}
                {!isSearching && results.length === 0 && (
                  <div className="px-4 py-3 text-xs font-bold text-slate-400">
                    Sin resultados para «{barcode.trim()}»
                  </div>
                )}
                {results.map((med, index) => (
                  <button
                    key={`${med.barCode || index}-${index}`}
                    type="button"
                    onClick={() => handleSelect(med)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors cursor-pointer border-b border-slate-100 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{med.name}</p>
                      <p className="text-[10px] font-semibold text-slate-400 truncate">
                        {[med.brand, med.activeIngredient, med.barCode].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-blue-600">{formatPrice(med.price ?? 0)}</p>
                      <p className="text-[10px] font-semibold text-slate-400">Stock: {med.stock ?? 0}</p>
                    </div>
                  </button>
                ))}
                {isLoadingMore && (
                  <div className="px-4 py-2 text-xs font-bold text-slate-400 text-center">Cargando más...</div>
                )}
              </div>
            </div>
          )}
          {error && (
            <p className="mt-1 text-[10px] font-bold text-red-500">{error}</p>
          )}
        </div>
        <button
          onClick={() => handleAdd()}
          className="px-8 py-3 bg-[#0055ff] hover:bg-blue-700 text-white rounded-xl font-black text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
        >
          ENTER - Agregar
        </button>
      </div>
    </div>
  );
}
