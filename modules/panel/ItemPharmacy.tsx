"use client";

import { HiChevronDown } from "react-icons/hi";
import { VentasTotales } from "./ventasTotales.constans";

export default function FeaturedPharmacies({
  pharmacies = [],
}: {
  pharmacies?: VentasTotales[];
}) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 flex-1 h-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">
          Farmacias Destacadas
        </h2>
        <div className="relative group">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all">
            Vista: Mensual
            <HiChevronDown size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {pharmacies.length > 0 ? (
          pharmacies.map((pharmacy) => (
            <div
              key={pharmacy.name_pharmacy}
              className="flex items-center p-5 bg-gray-50/50 hover:bg-gray-100/50 transition-all rounded-[1.5rem] border border-transparent group"
            >
              <div className="flex-shrink-0 w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${pharmacy.name_pharmacy}&backgroundColor=f1f5f9`}
                  alt={pharmacy.name_pharmacy}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="ml-5 flex-grow">
                <h3 className="text-lg font-black text-gray-800 tracking-tight">
                  {pharmacy.name_pharmacy}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-500">
                    $
                    {pharmacy.total_orders.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    USD
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    •{" "}
                    {pharmacy.categories?.reduce(
                      (acc, c) => acc + c.count,
                      0,
                    ) || 0}{" "}
                    órdenes
                  </span>
                </div>
              </div>

              <button className="px-4 py-1.5 text-blue-600 font-black text-xs hover:bg-blue-50 rounded-lg transition-colors">
                Ver más
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400 italic text-center py-10">
            No hay farmacias destacadas
          </p>
        )}
      </div>
    </div>
  );
}
