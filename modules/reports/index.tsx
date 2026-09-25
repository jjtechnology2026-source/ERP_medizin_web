"use client";

export default function Reportes() {
  return (
    <div className="p-8 max-w-8xl mx-auto bg-[#f8f9fa] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[#0052ff]">Reporte general</h1>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <span>Datos de los últimos 90 días</span>
        </div>
      </div>
    </div>
  );
}
