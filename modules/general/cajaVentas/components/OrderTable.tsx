"use client";
import React from "react";
import { HiOutlinePlus } from "react-icons/hi";

export function OrderTable() {
  // Datos temporales para visualización
  const items: any[] = [];

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 flex flex-col overflow-hidden">
      {/* Tabs Internos */}
      <div className="flex border-b border-slate-50 p-2 gap-2 bg-slate-50/30">
        <button className="bg-[#00d8ff] text-white px-8 py-3 rounded-xl font-black text-xs shadow-sm">Orden 1</button>
        <button className="bg-blue-600 text-white p-3 rounded-xl shadow-sm active:scale-90 transition-all">
          <HiOutlinePlus size={18} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#FBFCFE]">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-50 last:border-0 text-center">
                Código de barra
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-50 last:border-0">
                Nombre del Producto
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-50 last:border-0 text-center">
                Precio de venta
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-50 last:border-0 text-center">
                Cantidad
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-50 last:border-0 text-center">
                Existencia
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-32 text-center text-slate-300 font-bold italic">
                  No hay productos añadidos a esta orden...
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  {/* Celdas del item */}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
