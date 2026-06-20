"use client";
import FiscalConfigCard from "./components/FiscalConfigCard";

export default function Settings() {
  return (
    <div className="flex flex-col gap-10 p-6 md:p-12 bg-[#FBFCFE] min-h-full w-full">
      <header className="flex flex-col gap-1 max-w-[1600px] mx-auto w-full">
        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Configuración del Sistema</h1>
        <p className="text-base font-bold text-slate-400">Ajusta los parámetros operativos de Medizin</p>
      </header>

      <main className="flex flex-col gap-16 max-w-[1600px] mx-auto w-full">
        <section id="fiscal">
          <FiscalConfigCard />
        </section>
      </main>
    </div>
  );
}
