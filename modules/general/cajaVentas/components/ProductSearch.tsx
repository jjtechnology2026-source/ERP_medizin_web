"use client";
import React from "react";
import { HiOutlineSearch, HiOutlineQrcode, HiOutlineTrash, HiOutlineInformationCircle, HiOutlinePlus } from "react-icons/hi";

export function ProductSearch() {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
            <HiOutlineQrcode size={14} /> Código del Producto
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Código del producto o nombre del producto"
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <button className="bg-[#005eff] text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all">
          ENTER - Agregar
        </button>
      </div>

      <div className="flex flex-wrap gap-4 pt-2">
        <ActionButton icon={<HiOutlinePlus />} label="Agregar varios" color="blue" />
        <ActionButton icon={<HiOutlineSearch />} label="Buscar" color="emerald" />
        <ActionButton icon={<HiOutlineInformationCircle />} label="Consultar" color="amber" />
        <ActionButton icon={<HiOutlineTrash />} label="Eliminar Art." color="rose" />
      </div>
    </div>
  );
}

const ActionButton = ({ icon, label, color }: { icon: React.ReactNode; label: string; color: "blue" | "emerald" | "amber" | "rose" }) => {
  const colorMap = {
    blue: "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-100",
    emerald: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100",
    amber: "bg-amber-500 hover:bg-amber-600 shadow-amber-100",
    rose: "bg-rose-500 hover:bg-rose-600 shadow-rose-100",
  };

  return (
    <button
      className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white text-xs font-black transition-all active:scale-95 shadow-md ${colorMap[color]}`}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { size: 16 })}
      {label}
    </button>
  );
};
