import React from "react";
import { 
  HiOutlineDownload, 
  HiOutlineLockClosed, 
  HiOutlineCash, 
  HiOutlineCreditCard, 
  HiOutlineCurrencyDollar, 
  HiOutlineDeviceMobile, 
  HiOutlineFingerPrint,
  HiOutlineCalculator,
  HiOutlineInformationCircle
} from "react-icons/hi";

const CashClosurePage = () => {
  // Datos representativos de los métodos de pago
  const salesData = [
    { label: "Efectivo Bs.", value: "0.00", icon: <HiOutlineCash />, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Divisas $", value: "0.00 USD", icon: <HiOutlineCurrencyDollar />, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Tarjetas", value: "0.00", icon: <HiOutlineCreditCard />, color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Pago Móvil", value: "0.00", icon: <HiOutlineDeviceMobile />, color: "text-pink-500", bg: "bg-pink-50" },
    { label: "Biopago", value: "0.00", icon: <HiOutlineFingerPrint />, color: "text-orange-500", bg: "bg-orange-50" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-10 font-sans text-slate-900">
      
      {/* --- HEADER --- */}
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-800">
            Cierre de <span className="text-[#005eff]">Caja</span>
          </h1>
          <p className="text-slate-500 mt-1">Resumen detallado de transacciones del día.</p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            <HiOutlineDownload className="text-xl text-emerald-500" />
            Reporte
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#005eff] hover:bg-[#004cd4] text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 active:scale-95">
            <HiOutlineLockClosed className="text-xl" />
            Cerrar Turno
          </button>
        </div>
      </header>

      {/* --- MAIN CONTENT GRID --- */}
      <main className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          
          {/* COLUMNA IZQUIERDA: Detalle de Ventas (Ocupa 3 de 5 columnas) */}
          <section className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-50 text-[#005eff] rounded-2xl">
                <HiOutlineCalculator size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Ventas Totales</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {salesData.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 rounded-3xl border border-transparent bg-slate-50/30 hover:bg-slate-50 hover:border-slate-100 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${item.bg} ${item.color} transition-transform`}>
                      {item.icon}
                    </div>
                    <span className="font-bold text-slate-600 text-sm">{item.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-800 tracking-tighter">
                      {item.value}
                    </p>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Neto</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* COLUMNA DERECHA: Balance y Estado (Ocupa 2 de 5 columnas) */}
          <aside className="lg:col-span-2 space-y-6">
            
            {/* Card de Balance Consolidado */}
            <div className="bg-white rounded-[2.5rem] border-2 border-[#005eff]/5 shadow-xl shadow-blue-500/5 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#005eff]/5 rounded-full -mr-16 -mt-16" />
              
              <h3 className="text-xs font-black text-[#005eff] uppercase tracking-[0.2em] mb-10 flex items-center gap-2">
                Balance de Caja
              </h3>

              <div className="space-y-10">
                <div>
                  <span className="text-slate-400 text-sm font-semibold">Total en Bolívares</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-black text-slate-900 tracking-tighter">0.00</span>
                    <span className="text-[#005eff] font-bold text-xl font-mono">Bs.</span>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100">
                  <span className="text-slate-400 text-sm font-semibold">Total en Divisas</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-black text-slate-900 tracking-tighter">0.00</span>
                    <span className="text-emerald-500 font-bold text-xl font-mono">USD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Widget de Estado (Versión Minimalista) */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <HiOutlineLockClosed size={24} />
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Punto de Venta</p>
                  <h4 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Caja Abierta</h4>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100/50 rounded-full border border-emerald-200/50">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">Activa</span>
              </div>
            </div>

            {/* Mensaje Informativo */}
            <div className="flex gap-3 px-4 py-2 bg-blue-50/50 rounded-2xl border border-blue-100/50">
              <HiOutlineInformationCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
              <p className="text-blue-700/80 text-[11px] font-medium leading-relaxed">
                Verifica los montos físicos antes de procesar el cierre. Esta acción es irreversible.
              </p>
            </div>

          </aside>
        </div>
      </main>
    </div>
  );
};

export default CashClosurePage;