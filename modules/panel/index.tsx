"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PromoCarousel } from "./components/PromoCarousel";
import { SalesTypeCard } from "./components/SalesTypeCard";
import { TopProductsCard } from "./components/TopProductsCard";
import PanelStatsCards from "./components/PanelStatsCard";
import { usePanel } from "./hooks/usePanel";

export default function PanelFeature() {
  const {
    profile,
    totalSales,
    totalOrders,
    totalUsers,
    canceledOrders,
    saleTypeCounts,
    topProducts,
    monthOptions,
    selectedMonthKey,
    setSelectedMonthKey,
    trends,
    salesTrend,
  } = usePanel();

  return (
    <div className="flex flex-col gap-10 p-6 md:p-10 bg-[#FBFCFE] min-h-full">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Panel de control</h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
          Bienvenido de nuevo, <span className="text-blue-600">{profile?.name || "Administrador"}</span>
        </p>
      </header>

      {/* Usamos el nuevo componente pasándole los datos necesarios */}
      <PanelStatsCards totalUsers={totalUsers} totalOrders={totalOrders} totalSales={totalSales} canceledOrders={canceledOrders} trends={trends} salesTrend={salesTrend} />

      {salesTrend.length > 1 && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 md:p-8">
          <h3 className="text-lg font-black text-slate-800 mb-4">Tendencia de Ventas</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrend}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700 }} />
                <Area type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorVentas)" name="Ventas ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="w-full">
        <PromoCarousel />
      </div>

      <div className="rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 group">
        <img
          src="https://img.freepik.com/free-vector/clean-medical-background_53876-116875.jpg"
          alt="Banner publicitario"
          className="w-full h-45 object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
        <SalesTypeCard
          monthOptions={[{ key: "all", label: "Todos los meses" }, ...monthOptions]}
          selectedMonthKey={selectedMonthKey}
          onMonthChange={setSelectedMonthKey}
          counts={saleTypeCounts}
        />
        <TopProductsCard products={topProducts} />
      </div>

      <div className="h-4" />
    </div>
  );
}
