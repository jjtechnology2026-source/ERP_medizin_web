"use client";
import React, { useState } from "react";

// Datos de soporte fiscal agrupados
const FISCAL_SUPPORT_DATA = [
  {
    id: "pos_venezuela",
    name: "POS Venezuela",
    status: "Soportado",
    description: "Disponible mediante la integracion de la libreria POSV.",
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
    description: "Disponible mediante la secuencia 80/81/810 del paquete The Factory.",
  },
];

export default function FiscalConfigCard() {
  const [implementation, setImplementation] = useState("POS Venezuela");
  const [port, setPort] = useState("99");
  const [exchangeRate, setExchangeRate] = useState("");

  const handleAction = (action: string) => {
    console.log(`Ejecutando acción: ${action}`);
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* --- SECCIÓN SUPERIOR: CONFIGURACIÓN Y ESTADO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-8 items-start">
        
        {/* Card 1: Configuración Fiscal */}
        <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-10">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Configuración fiscal</h2>
            <p className="text-sm font-bold text-slate-400 max-w-2xl">Organiza la tasa, la implementación fiscal y las acciones operativas en un solo bloque.</p>
          </div>

          <div className="flex flex-col gap-8 max-w-3xl">
            {/* Input: Tipo de Cambio */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-black text-slate-800 uppercase tracking-widest ml-1">
                Ingrese el tipo de cambio: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="tipo de cambio"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="w-full p-5 bg-[#E9E9E9] border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base font-bold text-slate-600 placeholder:text-slate-400"
              />
            </div>

            {/* Select: Implementación Fiscal */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-black text-slate-800 uppercase tracking-widest ml-1">
                Implementación Fiscal: <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={implementation}
                  onChange={(e) => setImplementation(e.target.value)}
                  className="w-full p-5 bg-[#E9E9E9] border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base font-bold text-slate-600 appearance-none pr-12"
                >
                  <option>POS Venezuela</option>
                  <option>PNP</option>
                  <option>The Factory HKA</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Input: Puerto */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-black text-slate-800 uppercase tracking-widest ml-1">
                Puerto de la máquina fiscal: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="99"
                className="w-full p-5 bg-[#E9E9E9] border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base font-bold text-slate-600"
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-5 mt-2">
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => handleAction("Guardar Tasa")}
                className="px-10 py-5 bg-[#005eff] text-white font-black text-[15px] rounded-xl shadow-lg shadow-blue-100 hover:brightness-110 transition-all active:scale-95"
              >
                Guardar Tasa
              </button>
              <button
                onClick={() => handleAction("Guardar Configuración Fiscal")}
                className="px-10 py-5 bg-[#005eff] text-white font-black text-[15px] rounded-xl shadow-lg shadow-blue-100 hover:brightness-110 transition-all active:scale-95"
              >
                Guardar Configuración Fiscal
              </button>
              <button
                onClick={() => handleAction("Abrir Diagnóstico Fiscal")}
                className="px-10 py-5 bg-[#E0E3FF] text-[#4F46E5] font-black text-[15px] rounded-xl hover:brightness-105 transition-all active:scale-95"
              >
                Abrir Diagnóstico Fiscal
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => handleAction("Ver Historial Reporte Z")}
                className="px-10 py-5 bg-[#0F172A] text-white font-black text-[15px] rounded-xl hover:brightness-125 transition-all active:scale-95"
              >
                Ver Historial Reporte Z
              </button>
              <button
                onClick={() => handleAction("Ver Auditoria Fiscal")}
                className="px-10 py-5 bg-[#7A3314] text-white font-black text-[15px] rounded-xl hover:brightness-110 transition-all active:scale-95"
              >
                Ver Auditoria Fiscal
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Estado Actual */}
        <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-10">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Estado actual</h2>
            <p className="text-sm font-bold text-slate-400">Resumen rápido de la implementación seleccionada y de las acciones disponibles.</p>
          </div>

          <div className="space-y-6">
            <div className="bg-[#F8FAFC] p-8 rounded-[2.5rem] border border-slate-50">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Implementación activa</p>
              <p className="text-base font-black text-slate-800">{implementation}</p>
            </div>

            <div className="bg-[#F8FAFC] p-8 rounded-[2.5rem] border border-slate-50">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Soporte adicional</p>
              <p className="text-base font-black text-emerald-600">Disponible</p>
            </div>
            
            <p className="text-xs font-bold text-slate-400 px-4 leading-relaxed">
              Disponible mediante la integracion de la libreria POSV.
            </p>
          </div>
        </div>
      </div>

      {/* --- SECCIÓN INFERIOR: SOPORTE POR IMPLEMENTACIÓN --- */}
      <div className="bg-white p-10 md:p-12 rounded-[3rem] shadow-sm border border-slate-100 space-y-10 mt-2">
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">Soporte por implementación</h2>
          <p className="text-base font-bold text-slate-400">Comparativa rápida para saber qué proveedor ofrece funciones adicionales.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FISCAL_SUPPORT_DATA.map((item) => (
            <div key={item.id} className="bg-[#F8FAFC] p-10 rounded-[2.5rem] border border-slate-100 flex flex-col gap-5">
              <div>
                <p className="text-lg font-black text-slate-800">{item.name}</p>
                <p className="text-[12px] font-black text-emerald-600 uppercase tracking-widest mt-1.5">{item.status}</p>
              </div>
              <p className="text-sm font-bold text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}