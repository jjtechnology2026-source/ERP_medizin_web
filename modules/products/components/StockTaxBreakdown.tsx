"use client";
import { useEffect, useMemo, useState } from "react";
import { HiArrowLeft, HiOutlineCash } from "react-icons/hi";
import { useProductsStore } from "@/modules/products/store/products.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { ViewState, Medication } from "@/modules/products/types/products.types";

interface TaxGroupProps {
  group: {
    vat: number;
    items: Medication[];
    totalStock: number;
    totalValue: number;
  };
  formatPrice: (p: number) => string;
}

function TaxGroupCard({ group, formatPrice }: TaxGroupProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const totalPages = Math.ceil(group.items.length / itemsPerPage);
  const displayedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return group.items.slice(start, start + itemsPerPage);
  }, [group.items, currentPage]);

  const avgPrice = group.totalStock > 0 ? group.totalValue / group.totalStock : 0;

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 space-y-6">
      {/* Encabezado en Píldora */}
      <div className="flex items-center justify-between">
        <div className="px-5 py-2 bg-blue-50 border border-blue-100 rounded-full flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse" />
          <span className="text-xs font-black text-blue-600 uppercase tracking-widest">IVA {group.vat}%</span>
        </div>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
          {group.items.length} producto{group.items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grilla de 3 Columnas para Métricas del Grupo */}
      <div className="grid grid-cols-3 gap-4 bg-slate-50/50 rounded-3xl p-5 border border-slate-100/50">
        <div className="flex flex-col text-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock total</span>
          <span className="text-base font-black text-slate-700">{group.totalStock} und</span>
        </div>
        <div className="flex flex-col text-center border-x border-slate-200/60">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor stock</span>
          <span className="text-base font-black text-blue-600">{formatPrice(group.totalValue)}</span>
        </div>
        <div className="flex flex-col text-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio promedio</span>
          <span className="text-base font-black text-slate-700">{formatPrice(avgPrice)}</span>
        </div>
      </div>

      {/* Lista de Productos Estilizada */}
      <div className="divide-y divide-slate-100">
        {displayedItems.map((med, i) => (
          <div key={med.barCode || i} className="py-4 flex justify-between items-center group/item hover:bg-slate-50/30 px-3 rounded-2xl transition-all duration-300">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-700 group-hover/item:text-blue-600 transition-colors">{med.name}</span>
              <span className="text-[10px] font-medium text-slate-400 mt-0.5">{med.brand}</span>
            </div>
            <div className="flex items-center gap-12">
              <div className="text-right">
                <span className="text-xs font-black text-slate-500">{med.stock} und</span>
                <p className="text-[9px] text-slate-400 mt-0.5">Stock</p>
              </div>
              <div className="text-right min-w-[100px]">
                <span className="text-sm font-black text-slate-700">{formatPrice(med.price * med.stock)}</span>
                <p className="text-[9px] text-slate-400 mt-0.5">{formatPrice(med.price)} c/u</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controles de Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:border-blue-200 hover:text-blue-600 disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-500 transition-all cursor-pointer"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:border-blue-200 hover:text-blue-600 disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-500 transition-all cursor-pointer"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StockTaxBreakdown({
  setView,
}: {
  setView: (v: ViewState) => void;
}) {
  const { inventory, isLoading, fetchInventory } = useProductsStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  useEffect(() => {
    if (inventory.length === 0) fetchInventory();
  }, [fetchInventory, inventory.length]);

  const groups = useMemo(() => {
    const map = new Map<number, { vat: number; items: Medication[]; totalStock: number; totalValue: number }>();

    for (const med of inventory) {
      const vat = med.vat ?? 0;
      const existing = map.get(vat) || { vat, items: [], totalStock: 0, totalValue: 0 };
      existing.items.push(med);
      existing.totalStock += med.stock;
      existing.totalValue += med.price * med.stock;
      map.set(vat, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.vat - a.vat);
  }, [inventory]);

  const globalTotal = useMemo(
    () => groups.reduce((s, g) => s + g.totalValue, 0),
    [groups]
  );

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${(price / (rate || 1)).toFixed(2)}`;
    return `Bs ${price.toFixed(2)}`;
  };

  if (isLoading && inventory.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto animate-in fade-in duration-500 space-y-6">
      <button
        onClick={() => setView("LIST")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-black text-[10px] uppercase tracking-wider transition-colors"
      >
        <HiArrowLeft size={14} /> Volver al inventario
      </button>

      <div className="flex justify-between items-end px-2">
        <h1 className="text-3xl font-black text-blue-600">Stock por Impuesto</h1>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-12 text-center text-slate-400 font-bold text-sm">
          No hay productos en inventario
        </div>
      ) : (
        <div className="space-y-8">
          {/* Tarjetas de Estadísticas Globales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl">
                <HiOutlineCash size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grupos de IVA</span>
                <span className="text-2xl font-black text-slate-800">{groups.length}</span>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-3xl">
                <HiOutlineCash size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Productos</span>
                <span className="text-2xl font-black text-slate-800">{inventory.length}</span>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-3xl">
                <HiOutlineCash size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidades en stock</span>
                <span className="text-2xl font-black text-slate-800">
                  {inventory.reduce((acc, med) => acc + med.stock, 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjetas de IVA */}
          <div className="space-y-6">
            {groups.map((group) => (
              <TaxGroupCard
                key={group.vat}
                group={group}
                formatPrice={formatPrice}
              />
            ))}
          </div>

          {/* Valor Total Global del Inventario */}
          <div className="bg-white text-slate-800 border border-slate-200 rounded-[2.5rem] p-8 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <span className="text-lg font-black uppercase tracking-wider">Valor Total del Inventario</span>
            <span className="text-3xl font-black text-blue-600">{formatPrice(globalTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
