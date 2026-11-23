"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { HiX, HiSearch } from "react-icons/hi";
import { productsService, type GroupProductAvailability } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

export default function GroupAvailabilityDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<GroupProductAvailability[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();
  const pharmacyId = useAuthStore.getState().profile?.pharmacyId;

  const formatPrice = (price: number) =>
    isDollar ? `$ ${price.toFixed(2)}` : `Bs ${(price * rate).toFixed(2)}`;

  const search = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      setError(null);
      if (!pharmacyId) {
        setRows(null);
        setError("No hay farmacia asignada.");
        return;
      }
      if (!q) {
        setRows(null);
        return;
      }
      setLoading(true);
      try {
        setRows(await productsService.getGroupAvailability(pharmacyId, q));
      } catch (e: any) {
        setRows(null);
        setError(e?.message || "Error al consultar en el grupo.");
      } finally {
        setLoading(false);
      }
    },
    [pharmacyId]
  );

  // Debounce: busca automáticamente al dejar de escribir.
  useEffect(() => {
    const q = code.trim();
    if (!q) {
      setRows(null);
      setError(null);
      return;
    }
    const timer = setTimeout(() => search(q), 400);
    return () => clearTimeout(timer);
  }, [code, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search(code);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-md">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl mx-4 max-h-[85vh] flex flex-col text-slate-800">
        <div className="flex items-center justify-between gap-2 p-6 pb-3 flex-shrink-0 max-lg:px-4">
          <h2 className="min-w-0 text-xl font-black text-slate-800">Buscar en mi grupo</h2>
          <button
            onClick={onClose}
            className="shrink-0 p-2 hover:bg-slate-100 rounded-xl transition-colors max-lg:min-h-11 max-lg:min-w-11"
            aria-label="Cerrar"
          >
            <HiX size={20} />
          </button>
        </div>

        <div className="px-6 flex-1 max-lg:overflow-x-hidden overflow-y-auto pb-6 max-lg:px-4">
          {!pharmacyId ? (
            <p className="text-xs font-bold text-red-500 text-center py-10">
              No hay farmacia asignada. No se puede consultar el grupo.
            </p>
          ) : (
            <>
              <div className="relative">
                <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Código o nombre del producto"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all placeholder:text-slate-400 max-lg:text-base"
                />
              </div>

              {code.trim() === "" ? (
                <p className="mt-4 text-xs font-bold text-slate-400">
                  Escanea o escribe el código o nombre del producto para ver la disponibilidad en tu grupo.
                </p>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#0055ff] border-t-transparent" />
                </div>
              ) : error ? (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                  {error}
                </div>
              ) : rows !== null && rows.length === 0 ? (
                <p className="mt-4 text-xs font-bold text-slate-500 text-center py-6">
                  Ninguna farmacia del grupo lo tiene.
                </p>
              ) : rows !== null ? (
                <ul className="mt-4 space-y-2">
                  {rows.map((g) => (
                    <li
                      key={`${g.bar_code || ""}-${g.farmacia_id}`}
                      // Phone: the pharmacy and the price stack under the product
                      // name so it gets the full 278px and is not truncated to a
                      // few characters by the price column (spec S7). From `sm` up
                      // the row is the desktop one (spec S4).
                      className="flex flex-col gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-700 truncate">{g.producto || "Producto"}</span>
                        <span className="block text-xs font-medium text-slate-400 truncate">{g.farmacia}</span>
                      </div>
                      <span className="flex flex-col text-xs font-black text-[#0057FF] whitespace-nowrap sm:block">
                        {formatPrice(g.precio ?? 0)}
                        <span className="block text-[10px] font-bold text-slate-400">
                          {g.cantidad ?? 0} unidades
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <div className="flex-shrink-0 p-6 pt-0 max-lg:px-4">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
