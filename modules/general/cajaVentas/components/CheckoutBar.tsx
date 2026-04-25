"use client";
import React from "react";
import { HiOutlineShoppingBag } from "react-icons/hi";

interface CheckoutBarProps {
  total?: number;
  itemCount?: number;
}

export function CheckoutBar({ total = 0, itemCount = 0 }: CheckoutBarProps) {
  return (
    <div className="bg-[#4f86f7] p-8 md:p-10 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group mt-auto">
      {/* Elementos decorativos */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />

      <div className="flex flex-col gap-1 z-10">
        <span className="text-white/70 text-xs font-black uppercase tracking-widest">Productos en la venta actual:</span>
        <h4 className="text-4xl font-black text-white">{itemCount}</h4>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8 z-10 w-full md:w-auto">
        <div className="flex flex-col items-center md:items-end">
          <span className="text-white/70 text-[10px] font-black uppercase tracking-widest mr-2">Total de venta:</span>
          <div className="bg-white px-8 py-3 rounded-2xl flex items-center gap-4 border-2 border-white/20 shadow-inner">
            <span className="text-3xl font-black text-slate-800">{total.toFixed(2)}</span>
            <span className="text-slate-400 font-black text-sm uppercase tracking-wider border-l border-slate-100 pl-4">USD</span>
          </div>
        </div>

        <button className="w-full md:w-auto flex items-center justify-center gap-3 px-12 py-5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-[1.5rem] text-white font-black transition-all active:scale-[0.98] border border-white/20 shadow-xl group/btn">
          <HiOutlineShoppingBag size={24} className="group-hover/btn:-rotate-12 transition-transform" />
          Procesar
        </button>
      </div>
    </div>
  );
}
