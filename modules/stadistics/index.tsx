"use client";
import React, { useState, useMemo } from "react";
import { HiSearch, HiOutlineRefresh } from "react-icons/hi";

// Interfaz para los productos de estadística
interface StatProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  controlled: boolean;
  cost: number;
  total: number;
}

// Mock ampliado para probar la paginación (8 elementos)
const mockStats: StatProduct[] = [
  { id: "1", name: "Acetabiofen", category: "malestar general", quantity: 27, controlled: false, cost: 0.02, total: 938.14 },
  { id: "2", name: "Zerobac galon", category: "producto", quantity: 4, controlled: false, cost: 0.01, total: 0.73 },
  { id: "3", name: "Cetaphil barra dermolimpiadora", category: "producto", quantity: 4, controlled: false, cost: 1.31, total: 1.53 },
  { id: "4", name: "sime", category: "Medicamentos", quantity: 5, controlled: false, cost: 23.2, total: 116.0 },
  { id: "5", name: "falvo", category: "Medicamentos", quantity: 5, controlled: false, cost: 15.0, total: 75.0 },
  { id: "6", name: "producto 5", category: "Medicamentos", quantity: 5, controlled: false, cost: 5.4, total: 27.0 },
  { id: "7", name: "producto 6", category: "Medicamentos", quantity: 5, controlled: false, cost: 6.55, total: 32.75 },
  { id: "8", name: "Amoxicilina 500mg", category: "Antibióticos", quantity: 12, controlled: true, cost: 0.50, total: 6.00 },
  { id: "9", name: "Vitamina C", category: "Suplementos", quantity: 50, controlled: false, cost: 0.10, total: 5.00 },
];

export default function StatisticsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Como solicitaste

  // 1. Lógica de Filtrado
  const filteredStats = useMemo(() => {
    return mockStats.filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (category === "" || item.category === category)
    );
  }, [search, category]);

  // 2. Lógica de Paginación
  const totalPages = Math.ceil(filteredStats.length / itemsPerPage);
  const currentItems = filteredStats.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const filterClass = "px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 flex items-center gap-2 hover:border-blue-400 transition-all min-w-[160px] outline-none shadow-sm focus:ring-2 focus:ring-blue-500/10";

  return (
    <div className="flex flex-col h-full gap-6 bg-[#FBFCFE] p-6 md:p-10">
      <h1 className="text-4xl font-black text-blue-600 tracking-tight">Estadísticas</h1>

      {/* --- FILTROS --- */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Buscador Marcado */}
        <div className="relative group flex-1 max-w-md">
          <input
            type="text"
            placeholder="buscar"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full bg-[#E9ECEF] border-2 border-transparent rounded-[2rem] py-3 pl-12 pr-4 text-sm font-bold text-slate-600 focus:bg-white focus:border-blue-500/30 transition-all outline-none placeholder:text-slate-500"
          />
          <HiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-600" size={22} />
        </div>

        <select className={filterClass} value={category} onChange={(e) => { setCategory(e.target.value); setCurrentPage(1); }}>
          <option value="">Por categoria</option>
          <option value="Medicamentos">Medicamentos</option>
          <option value="producto">Producto</option>
        </select>

        <select className={filterClass}>
          <option value="">Por fecha</option>
        </select>

        <button 
          onClick={() => { setSearch(""); setCategory(""); setCurrentPage(1); }}
          className="flex items-center gap-2 bg-[#FF2D20] text-white text-sm font-black px-6 py-3 rounded-[2rem] hover:bg-red-600 transition-all shadow-lg shadow-red-100 active:scale-95"
        >
          <HiOutlineRefresh className="rotate-180" /> Restablecer
        </button>
      </div>

      {/* --- TABLA --- */}
      <div className="flex-grow overflow-hidden border border-slate-200 rounded-[2.5rem] shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-100">
                {["Nombre del producto", "Categoria", "Cantidad", "Controlados", "Costo", "Total"].map((h) => (
                  <th key={h} className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
              {currentItems.length > 0 ? currentItems.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-8 py-5 text-sm font-bold text-slate-700">{item.name}</td>
                  <td className="px-8 py-5 text-sm font-semibold text-slate-400">{item.category}</td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-800">{item.quantity}</td>
                  <td className="px-8 py-5 text-sm font-black text-slate-400 uppercase">{item.controlled ? "SÍ" : "NO"}</td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-600">{item.cost.toFixed(2)} USD</td>
                  <td className="px-8 py-5 text-sm font-black text-slate-800">{item.total.toLocaleString()} USD</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-slate-400 font-bold">No se encontraron productos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* --- PAGINACIÓN (Estilo OrdersPage) --- */}
        <div className="p-6 border-t-2 border-slate-50 flex justify-between items-center bg-white">
          <p className="text-xs font-bold text-slate-400">
            Mostrando {currentItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredStats.length)} de {filteredStats.length} items
          </p>
          <div className="flex items-center gap-4">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => p - 1)} 
              className="p-2.5 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 shadow-sm transition-all active:scale-95 text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex items-center gap-1 font-bold text-xs">
              <span className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-md shadow-blue-100 min-w-[40px] text-center">
                {currentPage}
              </span>
              <span className="text-slate-400 px-2 text-[10px] uppercase tracking-tighter font-black">de</span>
              <span className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl min-w-[40px] text-center font-black">
                {totalPages || 1}
              </span>
            </div>
            <button 
              disabled={currentPage === totalPages || totalPages === 0} 
              onClick={() => setCurrentPage(p => p + 1)} 
              className="p-2.5 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 shadow-sm transition-all active:scale-95 text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}