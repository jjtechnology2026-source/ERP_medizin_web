"use client";
import { useState, useRef, useEffect } from "react";
import { HiQrcode } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useProductsStore } from "@/modules/products/store/products.store";
import { useProductSearch } from "@/modules/products/hooks/useProductSearch";

export default function ProductSearchBar() {
  const [barcode, setBarcode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addMedication } = useCurrentOrderStore();
  const { inventory } = useProductsStore();
  
  const { query, setQuery, results, reset } = useProductSearch({
    inventory,
    pageSize: 10,
    onlyInStock: true,
  });

  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = (med?: any) => {
    const code = med?.barCode || barcode.trim();
    if (!code) return;

    const product = med || inventory.find((m) => m.barCode === code);
    if (!product) {
      setBarcode("");
      reset();
      setShowDropdown(false);
      return;
    }

    const result = addMedication(product, 1);
    if (!result.success) {
      console.warn(result.error);
    }
    setBarcode("");
    setQuery("");
    reset();
    setShowDropdown(false);
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
            value={barcode || query}
            onChange={(e) => {
              const val = e.target.value;
              setBarcode(val);
              setQuery(val);
              setShowDropdown(val.trim().length > 0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if ((barcode || query).trim().length > 0) {
                setShowDropdown(true);
              }
            }}
            placeholder="Código del producto o nombre del producto"
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400"
            autoFocus
          />
          {showDropdown && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto">
              {results.map((med, idx) => (
                <button
                  key={med.barCode || idx}
                  onClick={() => handleAdd(med)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors border-b border-slate-50 last:border-0"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-700 truncate">{med.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{med.activeIngredient} • {med.brand}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{med.barCode}</p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-xs font-black text-blue-600">Bs {med.price.toFixed(2)}</p>
                      <p className={`text-[9px] font-bold ${med.stock > 0 ? "text-emerald-600" : "text-slate-300"}`}>
                        {med.stock > 0 ? `${med.stock} stock` : "Sin stock"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
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
