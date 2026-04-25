"use client";
import React, { useState } from "react";
import { HiOutlineAdjustments, HiOutlineScale, HiOutlineChip } from "react-icons/hi";
import ExchangeRateCard from "./components/ExchangeRateCard";
import FiscalConfigCard from "./components/FiscalConfigCard";

const SETTINGS_SECTIONS = [
  { id: "general", label: "General", icon: <HiOutlineAdjustments size={20} /> },
  { id: "exchange", label: "Tipo de Cambio", icon: <HiOutlineScale size={20} /> },
  { id: "fiscal", label: "Máquina Fiscal", icon: <HiOutlineChip size={20} /> },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState("general");

  return (
    <div className="flex flex-col gap-10 p-6 md:p-10 bg-[#FBFCFE] min-h-full">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Configuración del Sistema</h1>
        <p className="text-sm font-bold text-slate-400">Ajusta los parámetros operativos de Medizin</p>
      </header>

      {/* Layout de Configuraciones */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 items-start">
        
        {/* Sidebar Sutil de Navegación */}
        <aside className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 space-y-3 sticky top-28 h-fit">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest px-4 mb-4">Secciones</h3>
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-150 active:scale-95 ${
                activeSection === section.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                  : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </aside>

        {/* Contenido Principal de Configuraciones */}
        <main className="space-y-8">
          {/* Aquí renderizamos las tarjetas según la sección activa */}
          {activeSection === "general" && (
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-50 text-center text-slate-400 font-bold italic">
              Configuraciones generales próximamente...
            </div>
          )}
          
          {(activeSection === "exchange" || activeSection === "general") && (
            <ExchangeRateCard />
          )}

          {(activeSection === "fiscal" || activeSection === "general") && (
            <FiscalConfigCard />
          )}
        </main>
      </div>
    </div>
  );
}