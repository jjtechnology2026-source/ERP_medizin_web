"use client";
import { useState, useRef, useEffect } from "react";
import { Medication } from "@/modules/products/types/products.types";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { productsService } from "@/modules/products/api/products.service";

const REMOTE_DEBOUNCE_MS = 600;
const MIN_REMOTE_CHARS = 2;

export default function StockAutocomplete({
  onSelect,
}: {
  onSelect: (med: Medication) => void;
}) {
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Sugerencias locales: búsqueda server-side del inventario de la farmacia.
  const [suggestions, setSuggestions] = useState<Medication[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isLocalSearching, setIsLocalSearching] = useState(false);

  useEffect(() => {
    const q = debouncedQuery.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (!q) {
        setSuggestions([]);
        setTotalMatches(0);
        return;
      }
      const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
      if (!pharmacyId) return;
      setIsLocalSearching(true);
      try {
        const page = await productsService.getCursorInventory(pharmacyId, { query: q, limit: 10 });
        if (cancelled) return;
        setSuggestions(page.medications);
        setTotalMatches(page.medications.length);
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setTotalMatches(0);
        }
      } finally {
        if (!cancelled) setIsLocalSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [debouncedQuery]);

  const [remoteResults, setRemoteResults] = useState<Medication[]>([]);
  const [isRemoteSearching, setIsRemoteSearching] = useState(false);

  useEffect(() => {
    const q = debouncedQuery.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (q.length < MIN_REMOTE_CHARS || totalMatches > 0) {
        setRemoteResults([]);
        setIsRemoteSearching(false);
        return;
      }
      const localBarCodes = new Set(suggestions.map((m) => m.barCode));
      setIsRemoteSearching(true);
      try {
        const res = await productsService.searchProducts(q, 20);
        if (cancelled) return;
        setRemoteResults(
          res.medications
            .filter((m) => m.barCode && !localBarCodes.has(m.barCode))
            .slice(0, 10)
        );
      } catch {
        if (!cancelled) setRemoteResults([]);
      } finally {
        if (!cancelled) setIsRemoteSearching(false);
      }
    }, REMOTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [debouncedQuery, totalMatches, suggestions]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [debouncedQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[focusedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[focusedIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const handleSelect = (med: Medication) => {
    setQuery(med.name);
    setIsOpen(false);
    onSelect(med);
  };

  const showDropdown =
    isOpen &&
    debouncedQuery.trim().length > 0 &&
    (suggestions.length > 0 ||
      remoteResults.length > 0 ||
      isLocalSearching ||
      isRemoteSearching ||
      totalMatches === 0);

  const remoteRow = (med: Medication, i: number) => (
    <button
      key={`remote-${med.barCode || i}`}
      onClick={() => handleSelect(med)}
      onMouseEnter={() => setFocusedIndex(-1)}
      className="w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors hover:bg-blue-50/50"
    >
      <div className="size-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
        {med.image ? (
          <img src={med.image} alt="" className="w-full h-full object-cover rounded-lg" />
        ) : (
          "○"
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-700 truncate">{med.name}</p>
        <p className="text-[11px] text-slate-400 font-medium truncate">
          {med.activeIngredient} - {med.brand}
        </p>
      </div>
      <div className="ml-auto text-right shrink-0">
        <p className="text-xs font-black text-blue-600">
          {isDollar ? `$${med.price.toFixed(2)}` : `Bs ${(med.price * rate).toFixed(2)}`}
        </p>
        <span className="text-[10px] font-bold text-blue-400">Catálogo</span>
      </div>
    </button>
  );

  return (
    <div className="relative">
      <p className="text-xs font-bold text-slate-400 mb-3 text-center">
        Para publicar mas rápido, busquemos tu producto en nuestro catálogo
      </p>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar producto por nombre o código..."
        className="w-full px-4 py-3.5 bg-slate-100 border-transparent rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400 font-bold"
      />

      {showDropdown && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50"
        >
          {totalMatches > suggestions.length && (
            <div className="px-4 py-2 text-[10px] font-bold text-slate-400 bg-slate-50 border-b border-slate-100">
              Mostrando {suggestions.length} de {totalMatches} coincidencias
            </div>
          )}
          {suggestions.map((med, i) => (
            <button
              key={med.barCode || i}
              onClick={() => handleSelect(med)}
              onMouseEnter={() => setFocusedIndex(i)}
              className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors ${
                focusedIndex === i ? "bg-blue-50" : "hover:bg-slate-50"
              }`}
            >
              <div className="size-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
                {med.image ? (
                  <img src={med.image} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  "○"
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{med.name}</p>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  {med.activeIngredient} - {med.brand}
                </p>
              </div>
              <div className="ml-auto text-right shrink-0">
                <p className="text-xs font-black text-blue-600">
                  {isDollar ? `$${med.price.toFixed(2)}` : `Bs ${(med.price * rate).toFixed(2)}`}
                </p>
                <span className="text-[10px] font-bold text-slate-400">{med.stock} u.</span>
              </div>
            </button>
          ))}

          {(remoteResults.length > 0 || isRemoteSearching) && suggestions.length > 0 && (
            <div className="px-4 py-2 text-[10px] font-bold text-slate-400 bg-slate-50 border-y border-slate-100">
              Catálogo nacional
            </div>
          )}
          {(isLocalSearching || isRemoteSearching) && suggestions.length === 0 && remoteResults.length === 0 && (
            <div className="px-4 py-3 text-xs font-bold text-slate-400 text-center">
              Buscando en el inventario y catálogo…
            </div>
          )}
          {remoteResults.map((med, i) => remoteRow(med, i))}
          {!isLocalSearching &&
            !isRemoteSearching &&
            suggestions.length === 0 &&
            remoteResults.length === 0 && (
              <div className="px-4 py-3 text-xs font-bold text-slate-400 text-center">
                Sin resultados en el inventario ni en el catálogo
              </div>
            )}
        </div>
      )}
    </div>
  );
}