"use client";
import React, { useState } from "react";
import { HiOutlineChip, HiCheckCircle, HiRefresh, HiClipboardList, HiDocumentSearch } from "react-icons/hi";

// Datos de soporte fiscal agrupados
const FISCAL_SUPPORT_DATA = [
  {
    id: "pos_venezuela",
    name: "POS Venezuela",
    status: "Soportado",
    description: "Soportado mediante comprobante no fiscal vinculado en la librería POSV.",
  },
  {
    id: "pnp",
    name: "PNP",
    status: "Soportado",
    description: "Soportado mediante PFAbreNF, PFLine aNF y PFCierraNF en la DLL PNP.",
  },
  {
    id: "factory_hka",
    name: "The Factory HKA",
    status: "Soportado",
    description: "Soportado mediante la secuencia no fiscal 80/81/810 del paquete The Factory.",
  },
];

export default function FiscalConfigCard() {
  const [implementation, setImplementation] = useState("POS Venezuela");
  const [port, setPort] = useState("99");

  const handleAction = (action: string) => {
    console.log(`Ejecutando acción: ${action}`);
    alert(`Ejecutando: ${action}`);
  };

  return (
    <section className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-50 space-y-10">
      
      {/* Encabezado de Sección */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <HiOutlineChip size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Implementación Fiscal</h2>
          <p className="text-sm font-bold text-slate-400">Configura la impresora y el soporte para documentos</p>
        </div>
      </div>

      {/* --- SUBSECCIÓN: CONFIGURACIÓN BÁSICA --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        {/* Implementación Dropdown */}
        <div className="flex flex-col gap-2.5 relative">
          <label htmlFor="implementation" className="text-sm font-bold text-slate-600">
            Implementación Fiscal <span className="text-red-500">*</span>
          </label>
          <select
            id="implementation"
            value={implementation}
            onChange={(e) => setImplementation(e.target.value)}
            className="bg-[#F3F4F6] border-none rounded-2xl py-4 pl-6 pr-12 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none appearance-none"
          >
            <option>POS Venezuela</option>
            <option>PNP</option>
            <option>The Factory HKA</option>
          </select>
          <HiRefresh className="absolute right-6 top-[55px] text-slate-400" size={18} />
        </div>

        {/* Puerto Input */}
        <div className="flex flex-col gap-2.5">
          <label htmlFor="port" className="text-sm font-bold text-slate-600">
            Puerto de la máquina fiscal <span className="text-red-500">*</span>
          </label>
          <input
            id="port"
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="99"
            className="bg-[#F3F4F6] border-none rounded-2xl py-4 pl-6 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* --- SUBSECCIÓN: ACCIONES Y SOPORTE (LAYOUT DE COLUMNAS) --- */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-x-10 gap-y-10 items-start">
        
        {/* COLUMNA IZQUIERDA: Botones de Acción (ahora en columna para alineación, pero en tarjeta) */}
        <div className="bg-slate-50/50 p-6 md:p-8 rounded-[2rem] shadow-inner border border-slate-100 flex flex-col gap-5 h-full">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest px-1 mb-2">Acciones Rápidas</h4>
          
          <button
            onClick={() => handleAction("Guardar Configuración")}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
          >
            <HiCheckCircle size={20} />
            Guardar Configuración
          </button>
          
          <button
            onClick={() => handleAction("Probar Documento")}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-[#576077] text-white font-black rounded-xl hover:bg-[#4a5264] transition-all active:scale-95"
          >
            <HiDocumentSearch size={20} />
            Probar Doc. No Fiscal
          </button>
          
          <button
            onClick={() => handleAction("Abrir Diagnóstico")}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-100 text-blue-700 font-black rounded-xl hover:bg-blue-200 transition-all active:scale-95"
          >
            <HiClipboardList size={20} />
            Abrir Diagnóstico
          </button>
        </div>

        {/* COLUMNA DERECHA: Lista de Soporte por Implementación */}
        <div className="space-y-6 flex-grow">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Soporte por implementación</h3>
            <p className="text-xs font-semibold text-slate-400">Estado de soporte para documentos no fiscales vinculados</p>
          </div>
          
          {FISCAL_SUPPORT_DATA.map((item) => (
            <div
              key={item.id}
              className="bg-white p-6 rounded-3xl border border-slate-100/70 shadow-sm transition-transform hover:scale-[1.01]"
            >
              <div className="flex justify-between items-start gap-4 mb-3">
                <span className="text-sm font-black text-slate-900">{item.name}</span>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};