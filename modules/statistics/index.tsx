"use client";
import React, { useMemo, useState } from "react";
import { HiSearch, HiOutlineRefresh } from "react-icons/hi";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { Order } from "@/modules/orders/types/orders";

interface StatProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  controlled: boolean;
  cost: number;
  total: number;
}

const aggregateProductStats = (orders: Order[]): StatProduct[] => {
  const map = new Map<string, StatProduct>();

  orders.forEach((order) => {
    const medications = order.medications || (order as any).medicines || [];
    medications.forEach((med: any) => {
      const name = med.name?.trim() || "Sin nombre";
      const category = med.category?.trim() || "Sin categoría";
      const controlled = !!med.controlled;
      const price = typeof med.price === "number" ? med.price : parseFloat(String(med.price)) || 0;
      const quantity = typeof med.quantity === "number" ? med.quantity : parseFloat(String(med.quantity)) || 0;
      const total = price * quantity;
      const key = `${name}|${category}|${controlled}`;

      const existing = map.get(key);
      if (existing) {
        existing.quantity += quantity;
        existing.total += total;
      } else {
        map.set(key, {
          id: key,
          name,
          category,
          quantity,
          controlled,
          cost: price,
          total,
        });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

export default function StatisticsPage() {
  const { profile } = useAuthStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const formatCurrencyLocal = (amount: number) => {
    if (isDollar) {
      return `$ ${amount.toFixed(2)}`;
    }
    return `Bs ${(amount * rate).toFixed(2)}`;
  };

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const query = useMemo(() => {
    const cleanParams: Record<string, string> = {
      limit: "500",
    };
    if (profile?.id_group && profile.id_group !== "undefined" && profile.id_group !== "null") {
      cleanParams.id_group = profile.id_group;
    }
    if (profile?.pharmacyId && profile.pharmacyId !== "undefined" && profile.pharmacyId !== "null") {
      cleanParams.id_pharmacy = profile.pharmacyId;
    }
    if (dateStart) {
      cleanParams["date.start"] = new Date(dateStart).toISOString();
    }
    if (dateEnd) {
      cleanParams["date.end"] = new Date(dateEnd).toISOString();
    }
    return new URLSearchParams(cleanParams).toString();
  }, [profile?.id_group, profile?.pharmacyId, dateStart, dateEnd]);

  const { data: orders = [], isLoading } = useApiQuery<Order[]>(
    ["statistics-orders-v2", query],
    `/admin/Orders/SearchOrders?${query}`,
    {
      enabled: true,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  const products = useMemo(() => aggregateProductStats(orders), [orders]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !category || product.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const categories = useMemo(() => Array.from(new Set(products.map((item) => item.category))).sort(), [products]);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const currentItems = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalQuantity = filteredProducts.reduce((sum, item) => sum + item.quantity, 0);
  const totalRevenue = filteredProducts.reduce((sum, item) => sum + item.total, 0);

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setDateStart("");
    setDateEnd("");
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col gap-6 min-h-full bg-[#F8FAFC] p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Estadísticas</p>
          <h1 className="text-4xl font-extrabold text-slate-900">Ventas por producto</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Revisa los productos vendidos con filtros por categoría, fechas y un resumen claro de cantidad, costo y total generado.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Productos</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{filteredProducts.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Cantidad total</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{totalQuantity}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Total ventas</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrencyLocal(totalRevenue)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr] xl:items-end">
          <div className="min-w-0">
            <div className="relative">
              <HiSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-600" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar producto"
                className="w-full min-w-0 rounded-3xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400"
              >
                <option value="">Por categoría</option>
                {categories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateStart}
                onChange={(event) => {
                  setDateStart(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400"
                aria-label="Fecha inicio"
              />
              <input
                type="date"
                value={dateEnd}
                onChange={(event) => {
                  setDateEnd(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400"
                aria-label="Fecha fin"
              />
              <button
                onClick={resetFilters}
                className="w-full rounded-3xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-100 transition hover:bg-rose-700"
              >
                <HiOutlineRefresh className="h-4 w-4" /> Restablecer filtros
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
          <div className="overflow-x-auto">
            <table className="min-w-225 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-white text-slate-500 uppercase tracking-[0.3em] text-[11px]">
                  {["Producto", "Categoría", "Cantidad", "Controlado", "Costo", "Total"].map((title) => (
                    <th key={title} className="px-6 py-5 font-semibold">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      Cargando datos...
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500">
                      No se encontraron productos con estos filtros.
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item) => (
                    <tr key={item.id} className="hover:bg-white/90 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{item.name}</td>
                      <td className="px-6 py-4 text-slate-600">{item.category}</td>
                      <td className="px-6 py-4 font-black text-slate-900">{item.quantity}</td>
                      <td className="px-6 py-4 text-slate-500 uppercase">{item.controlled ? "SÍ" : "NO"}</td>
                      <td className="px-6 py-4 text-slate-700">{formatCurrencyLocal(item.cost)}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{formatCurrencyLocal(item.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Mostrando {currentItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
              {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                disabled={currentPage === 1}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
