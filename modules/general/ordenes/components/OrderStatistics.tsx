"use client";

import React, { useState, useMemo } from "react";
import { RiArrowDownSLine, RiArrowRightSLine } from "react-icons/ri";
import { Ordenes } from "../types/ordenes.constants";

interface OrderStatisticsProps {
  orders: Ordenes[];
}

interface CategoryStats {
  name: string;
  total: number;
}

interface PharmacyStats {
  name: string;
  total: number;
  categories: CategoryStats[];
}

export function OrderStatistics({ orders }: OrderStatisticsProps) {
  const [expandedPharmacies, setExpandedPharmacies] = useState<Set<string>>(
    new Set(),
  );

  const stats = useMemo(() => {
    const pharmacyMap = new Map<string, PharmacyStats>();

    orders.forEach((order) => {
      const pharmacyName = order.pharmacy || "Desconocida";

      if (!pharmacyMap.has(pharmacyName)) {
        pharmacyMap.set(pharmacyName, {
          name: pharmacyName,
          total: 0,
          categories: [],
        });
      }

      const pStats = pharmacyMap.get(pharmacyName)!;
      pStats.total += order.totalreal;

      // Group by category within pharmacy
      const categoryMap = new Map<string, number>();
      pStats.categories.forEach((cat) => categoryMap.set(cat.name, cat.total));

      order.medications.forEach((med) => {
        const catName = med.category || "General";
        const currentCatTotal = categoryMap.get(catName) || 0;
        categoryMap.set(catName, currentCatTotal + med.price * med.quantity);
      });

      pStats.categories = Array.from(categoryMap.entries()).map(
        ([name, total]) => ({
          name,
          total,
        }),
      );
    });

    return Array.from(pharmacyMap.values());
  }, [orders]);

  const togglePharmacy = (name: string) => {
    const newSet = new Set(expandedPharmacies);
    if (newSet.has(name)) {
      newSet.delete(name);
    } else {
      newSet.add(name);
    }
    setExpandedPharmacies(newSet);
  };

  if (orders.length === 0) return null;

  return (
    <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <h2 className="text-xl font-bold text-gray-800 mb-6 px-1">
        Estadísticas por Farmacia
      </h2>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 grid grid-cols-3 py-4 px-6">
          <span className="text-[11px] font-black text-blue-50 uppercase tracking-widest">
            Nombre de la Farmacia
          </span>
          <span className="text-[11px] font-black text-blue-50 uppercase tracking-widest text-center">
            Por Categorías
          </span>
          <span className="text-[11px] font-black text-blue-50 uppercase tracking-widest text-right">
            Ventas Totales
          </span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100">
          {stats.map((pharmacy) => (
            <div key={pharmacy.name} className="flex flex-col">
              {/* Main row */}
              <button
                onClick={() => togglePharmacy(pharmacy.name)}
                className="grid grid-cols-3 py-5 px-6 items-center hover:bg-blue-50/30 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1 rounded-lg transition-colors ${expandedPharmacies.has(pharmacy.name) ? "bg-blue-100 text-blue-600" : "bg-gray-50 text-gray-400 group-hover:bg-blue-50"}`}
                  >
                    {expandedPharmacies.has(pharmacy.name) ? (
                      <RiArrowDownSLine size={18} />
                    ) : (
                      <RiArrowRightSLine size={18} />
                    )}
                  </div>
                  <span className="font-bold text-gray-700 uppercase text-sm">
                    {pharmacy.name}
                  </span>
                </div>

                <span className="text-center font-bold text-gray-600 text-sm">
                  {pharmacy.categories.length}
                </span>

                <span className="text-right font-black text-blue-600 text-sm">
                  {pharmacy.total.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  BS
                </span>
              </button>

              {/* Expanded details */}
              {expandedPharmacies.has(pharmacy.name) && (
                <div className="bg-gray-50/50 pb-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="mx-6 border-l-2 border-blue-100">
                    {pharmacy.categories
                      .sort((a, b) => b.total - a.total)
                      .map((category) => (
                        <div
                          key={category.name}
                          className="grid grid-cols-3 py-3 pl-8 pr-0 border-b border-gray-100/50 last:border-0 items-center"
                        >
                          <div className="flex items-center gap-2">
                            <RiArrowRightSLine
                              size={14}
                              className="text-blue-300"
                            />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">
                              {category.name}
                            </span>
                          </div>
                          <div /> {/* Spacer */}
                          <span className="text-right text-xs font-bold text-gray-600">
                            {category.total.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            BS
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
