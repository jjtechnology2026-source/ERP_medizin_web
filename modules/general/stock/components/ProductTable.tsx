"use client";
import React from "react";
import { HiOutlinePencilAlt, HiOutlineTrash, HiOutlineClock } from "react-icons/hi";

import { Tooltip } from "@/components/shared/tooltip";

export function ProductTable({ products }: { products: any[] }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#FBFCFE]">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Imagen</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Precio</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cantidad</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {products.map((product, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-100 overflow-hidden shadow-sm shadow-slate-100">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                </td>
                <td className="px-8 py-4">
                  <span className="text-sm font-black text-slate-700">{product.name}</span>
                </td>
                <td className="px-8 py-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{product.category}</span>
                </td>
                <td className="px-8 py-4 text-center">
                  <span className="text-sm font-black text-slate-800">{product.price.toFixed(2)} USD</span>
                </td>
                <td className="px-8 py-4 text-center">
                  <span className={`text-sm font-black ${product.quantity < 20 ? "text-rose-500" : "text-slate-600"}`}>
                    {product.quantity.toFixed(1)}
                  </span>
                </td>
                <td className="px-8 py-4">
                  <p className="text-xs font-medium text-slate-400 max-w-[200px] truncate">{product.description}</p>
                </td>
                <td className="px-8 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <Tooltip content="Editar">
                      <button className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100">
                        <HiOutlinePencilAlt size={20} />
                      </button>
                    </Tooltip>
                    <Tooltip content="Ver historial">
                      <button className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all border border-transparent hover:border-amber-100">
                        <HiOutlineClock size={20} />
                      </button>
                    </Tooltip>
                    <Tooltip content="Eliminar">
                      <button className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100">
                        <HiOutlineTrash size={20} />
                      </button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
