"use client";
import React, { useState } from "react";
import { HiOutlineSave, HiScale } from "react-icons/hi";

export default function ExchangeRateCard() {
  const [exchangeRate, setExchangeRate] = useState("");

  const handleSave = () => {
    // Aquí iría la lógica para llamar al endpoint de guardar tasa
    console.log("Guardando tasa:", exchangeRate);
    alert(`Tasa guardada: ${exchangeRate}`);
  };

  return (
    <section className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-50">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <HiScale size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tipo de Cambio</h2>
          <p className="text-sm font-bold text-slate-400">Define la tasa de conversión para facturación</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
        {/* Input Field */}
        <div className="flex flex-col gap-2.5">
          <label htmlFor="exchangeRate" className="text-sm font-bold text-slate-600">
            Ingrese el tipo de cambio <span className="text-red-500">*</span>
          </label>
          <input
            id="exchangeRate"
            type="number"
            step="0.01"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            placeholder="tipo de cambio (ej: 36.50)"
            className="bg-[#F3F4F6] border-none rounded-2xl py-4 pl-6 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Botón de Guardar */}
        <button
          onClick={handleSave}
          disabled={!exchangeRate}
          className="flex items-center justify-center gap-3 px-10 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-50 disabled:pointer-events-none h-full"
        >
          <HiOutlineSave size={20} />
          Guardar Tasa
        </button>
      </div>
    </section>
  );
};