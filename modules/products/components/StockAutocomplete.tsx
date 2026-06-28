"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Medication } from "@/modules/products/types/products.types";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

export default function StockAutocomplete({
  inventory,
  onSelect,
}: {
  inventory: Medication[];
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

  const { suggestions, totalMatches } = useMemo(() => {
    if (!debouncedQuery.trim()) return { suggestions: [], totalMatches: 0 };
    const q = debouncedQuery.toLowerCase();
    const allMatches = inventory.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.barCode.toLowerCase().includes(q) ||
        m.activeIngredient.toLowerCase().includes(q)
    );
    return {
      suggestions: allMatches.slice(0, 10),
      totalMatches: allMatches.length,
    };
  }, [inventory, debouncedQuery]);

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

      {isOpen && suggestions.length > 0 && (
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
        </div>
      )}
    </div>
  );
}
