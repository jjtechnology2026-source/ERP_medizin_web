"use client";

export default function Reportes() {
  return (
    /* Phone: `p-8` left 326px, and the title (`text-2xl`) shared one
       `justify-between` row with the subtitle, so both fought for that width.
       Below `sm` the padding is 16px and the row stacks; from `sm` up nothing
       changes (spec S4/S7). */
    <div className="p-4 max-w-8xl mx-auto bg-[#f8f9fa] min-h-screen sm:p-8">
      <div className="flex flex-col items-start gap-2 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[#0052ff]">Reporte general</h1>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <span className="wrap-break-word">Datos de los últimos 90 días</span>
        </div>
      </div>
    </div>
  );
}
