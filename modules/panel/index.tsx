"use client";

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
      <PanelStatsCards totalUsers={totalUsers} totalOrders={totalOrders} totalSales={totalSales} canceledOrders={canceledOrders} />

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
