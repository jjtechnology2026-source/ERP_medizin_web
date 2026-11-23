import React from "react";

interface TopProductsCardProps {
  products: { id: string; name: string; quantity: number }[];
}

export const TopProductsCard = ({ products }: TopProductsCardProps) => {
  const maxQuantity = products[0]?.quantity || 1;

  return (
    <div className="bg-white p-4 md:p-6 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-sm border border-slate-50 h-full">
      <h3 className="text-lg lg:text-xl font-black text-slate-800 mb-4 lg:mb-6">Productos más vendidos</h3>

      {products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">
          No hay datos disponibles.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {products.map((prod) => (
            <div key={prod.id} className="relative group">
               <div className="bg-slate-50 p-4 lg:p-5 rounded-2xl border border-slate-100 flex justify-between items-center gap-3 relative z-10">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-base lg:text-lg font-bold text-slate-700">{prod.name}</span>
                    <span className="text-sm font-semibold text-slate-400">{prod.quantity} ventas</span>
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-black text-sm">
                    #{products.indexOf(prod) + 1}
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
