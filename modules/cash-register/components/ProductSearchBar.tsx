"use client";
import { useState, useRef } from "react";
import { HiQrcode } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useProductsStore } from "@/modules/products/store/products.store";

export default function ProductSearchBar() {
  const [barcode, setBarcode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { addMedication } = useCurrentOrderStore();
  const { inventory } = useProductsStore();

  const handleAdd = () => {
    const code = barcode.trim();
    if (!code) return;

    const med = inventory.find((m) => m.barCode === code);
    if (!med) {
      setBarcode("");
      return;
    }

    const result = addMedication(med, 1);
    if (!result.success) {
      console.warn(result.error);
    }
    setBarcode("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
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
            placeholder="Código del producto o nombre del producto"
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400"
            autoFocus
          />
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
