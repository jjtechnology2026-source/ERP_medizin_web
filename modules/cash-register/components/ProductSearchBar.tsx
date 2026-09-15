"use client";
import { useState, useRef, useEffect } from "react";
import { HiQrcode } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useProductsStore } from "@/modules/products/store/products.store";
import { productsService } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { Medication } from "@/modules/products/types/products.types";

export default function ProductSearchBar() {
  const [barcode, setBarcode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { addMedication } = useCurrentOrderStore();
  const { findInventoryItem } = useProductsStore();

  const [results, setResults] = useState<Medication[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${price.toFixed(2)}`;
    return `Bs ${(price * rate).toFixed(2)}`;
  };

  // Búsqueda server-side con debounce en el texto del input.
  useEffect(() => {
    const text = barcode.trim();
    if (!text) {
      setResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }
    if (text.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setShowDropdown(true);
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
      if (!pharmacyId) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      try {
        const res = await productsService.getCursorInventory(pharmacyId, {
          query: text,
          limit: 10,
        });
        setResults(res.medications);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [barcode]);

  const handleAdd = async () => {
    const code = barcode.trim();
    if (!code) return;

    const med = await findInventoryItem(code);
    if (!med) {
      setBarcode("");
      return;
    }

    const result = addMedication(med, 1);
    if (!result.success) {
      console.warn(result.error);
    }
    setBarcode("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleSelect = (med: Medication) => {
    const result = addMedication(med, 1);
    if (!result.success) {
      console.warn(result.error);
    }
    setBarcode("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
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
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Código del producto o nombre del producto"
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400"
            autoFocus
          />

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              {isSearching && (
                <div className="px-4 py-3 text-xs font-bold text-slate-400">Buscando...</div>
              )}
              {!isSearching && results.length === 0 && (
                <div className="px-4 py-3 text-xs font-bold text-slate-400">
                  Sin resultados para «{barcode.trim()}»
                </div>
              )}
              {!isSearching &&
                results.map((med) => (
                  <button
                    key={med.barCode || med.name}
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
            </div>
          )}
        </div>
        <button
          onClick={handleAdd}
          className="px-8 py-3 bg-[#0055ff] hover:bg-blue-700 text-white rounded-xl font-black text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
        >
          ENTER - Agregar
        </button>
      </div>
    </div>
  );
}