"use client";
import React from "react";

export function BalanceDetails() {
  const items = [
    { label: "Dólares", value: "0", subValue: "0.00 USD", color: "blue" },
    { label: "Bolívares", value: "0", subValue: "0.00 BS", color: "emerald" },
    { label: "Total Dólares", value: "0.00", subValue: "USD", color: "indigo" },
    { label: "Total Bolívares", value: "0.00", subValue: "BS", color: "amber" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 flex flex-col gap-1 group hover:border-blue-100 transition-all"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-800">{item.value}</h3>
            <span className="text-xs font-bold text-slate-400 uppercase">{item.subValue}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
