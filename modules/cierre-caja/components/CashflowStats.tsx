"use client";
import React from "react";
import { HiOutlineCash, HiOutlineSwitchHorizontal, HiOutlineCreditCard } from "react-icons/hi";

export function CashflowStats() {
  return (
    <div className="bg-gradient-to-br from-[#4f86f7] to-[#3b71e3] p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
      <div className="relative z-10 flex flex-col gap-10">
        <header className="flex flex-col gap-1">
          <span className="text-white/70 text-xs font-black uppercase tracking-widest">Resumen de flujos</span>
          <h2 className="text-4xl font-black tracking-tight leading-tight">Cierre de Caja Diario</h2>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FlowItem icon={<HiOutlineCash />} label="Efectivo" value="0.00 USD" />
          <FlowItem icon={<HiOutlineSwitchHorizontal />} label="Transferencia" value="0.00 USD" />
          <FlowItem icon={<HiOutlineCreditCard />} label="Punto de Venta" value="0.00 USD" />
        </div>
      </div>

      {/* Decoración */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
    </div>
  );
}

const FlowItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:bg-white/20 transition-all cursor-default">
    <div className="p-3 bg-white/20 rounded-xl text-white">{React.cloneElement(icon as React.ReactElement<any>, { size: 24 })}</div>
    <div className="flex flex-col">
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
      <span className="text-xl font-black">{value}</span>
    </div>
  </div>
);
