"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { HiSearch, HiX, HiPlus, HiOutlineRefresh } from "react-icons/hi";
import { useProductsStore } from "@/modules/products/store/products.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { Medication, ViewState } from "@/modules/products/types/products.types";

export default function CatalogSearchPage({
  setView,
}: {
  setView: (v: ViewState) => void;
}) {
  const { inventory, catalog, fetchCatalog, isLoading, setCurrentMedicine, setEditMode } = useProductsStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedMed(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 200);
  }, []);

  const highlightMatch = (text: string, search: string) => {
    if (!search.trim() || !text) return text;
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200/60 text-slate-800 rounded-sm px-0.5">{part}</mark> : part
    );
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const catalogList = useMemo(() => {
    const map = new Map<string, Medication>();

    catalog.forEach(m => {
      if (m.barCode) map.set(m.barCode, m);
    });

    inventory.forEach(m => {
      if (m.barCode) map.set(m.barCode, m);
    });

    return Array.from(map.values());
  }, [inventory, catalog]);

  const [filterInStock, setFilterInStock] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterDosage, setFilterDosage] = useState<string>("all");
  const [searchPage, setSearchPage] = useState(1);
  const pageSize = 10;

  const brands = useMemo(() => {
    const set = new Set<string>();
    catalogList.forEach(m => { if (m.brand) set.add(m.brand); });
    return Array.from(set).sort();
  }, [catalogList]);

  const dosages = useMemo(() => {
    const set = new Set<string>();
    catalogList.forEach(m => { if (m.dosage) set.add(m.dosage); });
    return Array.from(set).sort();
  }, [catalogList]);

  const filteredResults = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q || q.length < 1) return [];
    let list = catalogList.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.activeIngredient || "").toLowerCase().includes(q) ||
        (m.barCode || "").toLowerCase().includes(q) ||
        (m.brand || "").toLowerCase().includes(q) ||
        (m.dosage || "").toLowerCase().includes(q) ||
        (m.tablets || "").toLowerCase().includes(q)
    );
    if (filterInStock === "yes") list = list.filter(m => m.stock > 0);
    else if (filterInStock === "no") list = list.filter(m => m.stock <= 0);
    if (filterBrand !== "all") list = list.filter(m => m.brand === filterBrand);
    if (filterDosage !== "all") list = list.filter(m => m.dosage === filterDosage);
    return list;
  }, [catalogList, debouncedQuery, filterInStock, filterBrand, filterDosage]);

  const suggestions = useMemo(() => filteredResults.slice(0, 4), [filteredResults]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const safePage = Math.min(searchPage, totalPages);
  const paginatedResults = useMemo(
    () => filteredResults.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredResults, safePage, pageSize]
  );

  const handleSelectRow = (med: Medication) => {
    setSelectedMed(selectedMed?.barCode === med.barCode ? null : med);
    setShowSuggestions(false);
  };

  const handleAccept = () => {
    if (selectedMed) {
      setCurrentMedicine(selectedMed);
      setEditMode(false);
      setView("STOCK_FEATURES");
    }
  };

  const formatPrice = (price: number) => {
    if (isDollar) return `$${price.toFixed(2)}`;
    return `Bs ${(price * rate).toFixed(2)}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 animate-in fade-in duration-300 space-y-6">
      <button
        onClick={() => setView("LIST")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-black text-[10px] uppercase tracking-wider transition-colors"
      >
        &lt; Regresar
      </button>

      <div className="space-y-2">
        <h1 className="text-3xl font-black text-slate-800 leading-tight">
          Agregar producto al inventario
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-blue-500 font-bold text-sm tracking-wide">
            Busca en el catálogo nacional de medicamentos y agrégalo a tu stock con precio e IVA.
          </p>
          {!isLoading && catalog.length > 0 && (
            <button
              onClick={() => fetchCatalog(true)}
              className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase hover:text-blue-600 transition-colors cursor-pointer"
              title="Recargar catálogo"
            >
              <HiOutlineRefresh size={14} /> Recargar catálogo
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-3xl" ref={searchRef}>
        <HiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 size-6" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Busca por nombre, principio activo, marca o código de barras..."
          className="w-full pl-14 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none text-base text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
        />
        {query && (
          <button
            onClick={() => { handleQueryChange(""); setShowSuggestions(false); }}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <HiX size={20} />
          </button>
        )}

        {showSuggestions && suggestions.length > 0 && query.length > 1 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
            {suggestions.map((med, idx) => (
              <button
                key={med.barCode || idx}
                onClick={() => {
                  handleSelectRow(med);
                  setQuery(med.name);
                  setDebouncedQuery(med.name);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 transition-colors border-b border-slate-50 last:border-0 text-left"
              >
                <div className="size-10 shrink-0 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex items-center justify-center">
                  {med.image ? (
                    <img src={med.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">💊</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{med.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{med.activeIngredient} • {med.brand}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-blue-600">{formatPrice(med.price)}</p>
                  <span className={`text-[9px] font-bold ${med.stock > 0 ? "text-emerald-600" : "text-slate-300"}`}>
                    {med.stock > 0 ? `${med.stock} en stock` : "Sin stock"}
                  </span>
                </div>
              </button>
            ))}
            {filteredResults.length > 4 && (
              <div className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 border-t border-slate-50">
                {filteredResults.length - 4} resultados más
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading && catalogList.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-bold text-slate-400">Cargando catálogo de productos...</span>
          </div>
        </div>
      )}

      {!isLoading && catalogList.length === 0 && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-sm font-bold text-slate-400">No se pudo cargar el catálogo de productos.</p>
          <p className="text-xs text-slate-300 mt-2">Verifica tu conexión o intenta nuevamente.</p>
          <button
            onClick={() => fetchCatalog()}
            className="mt-4 inline-flex items-center gap-2 text-xs font-black text-blue-600 uppercase hover:text-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {isLoading && catalog.length > 0 && (
        <div className="flex items-center gap-3 py-3 px-2">
          <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-bold text-blue-500">
            Cargando catálogo... {catalog.length.toLocaleString()} productos
          </span>
        </div>
      )}

      {debouncedQuery && (
        <div className="space-y-4">
          {filteredResults.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-2">
              <p className="text-xs font-bold text-slate-400">
                <span className="text-blue-600 font-black">{filteredResults.length}</span> resultados para &quot;{debouncedQuery}&quot;
                {selectedMed && <span className="ml-3 text-emerald-600 font-black">1 seleccionado</span>}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={filterInStock} onChange={e => { setFilterInStock(e.target.value); setSearchPage(1); }}
                  className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-500">
                  <option value="all">Todo stock</option>
                  <option value="yes">Con stock</option>
                  <option value="no">Sin stock</option>
                </select>
                <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setSearchPage(1); }}
                  className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-500 max-w-[130px]">
                  <option value="all">Todas las marcas</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={filterDosage} onChange={e => { setFilterDosage(e.target.value); setSearchPage(1); }}
                  className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-500 max-w-[100px]">
                  <option value="all">Toda dosis</option>
                  {dosages.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {filteredResults.length === 0 && query.length > 1 && (
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-12 text-center">
              <p className="text-sm font-bold text-slate-400">No se encontraron productos en el catálogo.</p>
              <p className="text-xs text-slate-300 mt-2">Intenta con otro término o crea el producto manualmente.</p>
              <button
                onClick={() => setView("CREATE_MANUAL")}
                className="mt-4 inline-flex items-center gap-2 text-xs font-black text-blue-600 uppercase hover:text-blue-700 transition-colors"
              >
                <HiPlus size={16} /> Crear producto manualmente
              </button>
            </div>
          )}

          {paginatedResults.length > 0 && (
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Principio Activo</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Dosis</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Presentación</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Marca</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Precio</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedResults.map((med, idx) => {
                      const isSelected = selectedMed?.barCode === med.barCode;
                      return (
                        <tr
                          key={med.barCode || idx}
                          onClick={() => handleSelectRow(med)}
                          className={`cursor-pointer transition-colors duration-150 ${
                            isSelected
                              ? "bg-blue-50 border-l-4 border-blue-500"
                              : "hover:bg-slate-50/60"
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="size-10 shrink-0 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden flex items-center justify-center">
                                {med.image ? (
                                  <img src={med.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-sm">💊</span>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-700">{med.name}</p>
                                <span className="text-[9px] text-slate-400 font-mono">{med.barCode}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 font-medium">{med.activeIngredient || "-"}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{med.dosage || "-"}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{med.tablets || "-"}</td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-slate-600">{med.brand || "-"}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-black text-blue-600">{formatPrice(med.price)}</span>
                            {med.controlled && <span className="ml-2 text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Rx</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold ${med.stock > 0 ? "text-emerald-600" : "text-slate-300"}`}>
                              {med.stock > 0 ? `${med.stock} und` : "Sin stock"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-white">
                  <span className="text-[10px] font-bold text-slate-400">
                    Página {safePage} de {totalPages} ({(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredResults.length)} de {filteredResults.length})
                  </span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setSearchPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:border-blue-200 hover:text-blue-600 disabled:opacity-30 transition-all cursor-pointer"
                    >Anterior</button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const start = Math.max(1, Math.min(safePage - 3, totalPages - 6));
                      const p = start + i;
                      if (p > totalPages) return null;
                      return (
                        <button key={p} onClick={() => setSearchPage(p)}
                          className={`w-8 h-8 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                            safePage === p
                              ? "bg-blue-600 text-white shadow-md"
                              : "bg-white border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600"
                          }`}
                        >{p}</button>
                      );
                    })}
                    <button onClick={() => setSearchPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:border-blue-200 hover:text-blue-600 disabled:opacity-30 transition-all cursor-pointer"
                    >Siguiente</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 px-2">
        <button
          onClick={() => setView("CREATE_MANUAL")}
          className="flex items-center gap-2 text-xs font-black text-blue-600 uppercase hover:text-blue-700 transition-colors"
        >
          <HiPlus size={16} /> ¿No encuentras el producto? Créalo manualmente
        </button>

        <button
          onClick={handleAccept}
          disabled={!selectedMed}
          className={`px-10 py-3.5 rounded-2xl font-black text-sm transition-all shadow-md ${
            selectedMed
              ? "bg-blue-600 text-white shadow-blue-100 hover:scale-105 active:scale-95 cursor-pointer"
              : "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
          }`}
        >
          Aceptar y Configurar Stock
        </button>
      </div>
    </div>
  );
}
