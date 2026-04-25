"use client";
import React, { useState } from "react";
import { ProductTable } from "./components/ProductTable";
import { HiOutlineCube, HiOutlineArchive, HiOutlinePlus } from "react-icons/hi";
import { useApiQuery } from "@/modules/core/hooks/useApi";

export default function StockFeature() {
  const [activeTab, setActiveTab] = useState<"general" | "low">("general");
  const { data: allProducts = [] } = useApiQuery<any[]>(["stock-products"], "/admin/Inventory/Stock");

  const filteredProducts = activeTab === "general" ? allProducts : allProducts.filter((p) => p.quantity < 20);

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10 bg-[#FBFCFE] min-h-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Productos en Stock</h1>
          <p className="text-sm font-bold text-slate-400">Control exhaustivo de inventario y existencias</p>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
            Descargar Inventario
          </button>
          <button className="flex items-center gap-2 px-8 py-4 bg-[#005eff] text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all">
            <HiOutlinePlus size={20} /> Añadir
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-sm transition-all ${
            activeTab === "general"
              ? "bg-[#4f86f7] text-white shadow-lg shadow-blue-100"
              : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
          }`}
        >
          <HiOutlineCube size={20} /> Stock General
        </button>
        <button
          onClick={() => setActiveTab("low")}
          className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-sm transition-all ${
            activeTab === "low" ? "bg-slate-800 text-white shadow-lg" : "bg-slate-200/50 text-slate-500 border border-slate-100 hover:bg-slate-200"
          }`}
        >
          <HiOutlineArchive size={20} /> Productos bajos en stock
        </button>
      </div>

      <ProductTable products={filteredProducts} />
    </div>
  );
}
