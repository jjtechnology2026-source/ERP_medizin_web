import { HiSearch } from "react-icons/hi";

export default function CatalogSearchPage({ setView }: any) {
  return (
    <div className="w-full flex flex-col justify-center items-center py-10 animate-in zoom-in-95 duration-300">
      <div className="w-full max-w-4xl bg-white rounded-[60px] p-12 lg:p-20 border border-slate-100 shadow-sm relative text-center">
        
        <button 
          onClick={() => setView('LIST')} 
          className="absolute top-10 left-10 text-[11px] font-black text-blue-600 uppercase hover:underline tracking-widest"
        >
          ‹ Regresar al stock
        </button>

        <div className="space-y-6">
          <h2 className="text-4xl lg:text-5xl font-black text-slate-800 leading-tight">
            Busca en el <br />
            <span className="text-blue-600">Catálogo Global</span>
          </h2>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-wide">
            Encuentra productos pre-cargados para ahorrar tiempo
          </p>
        </div>

        <div className="relative mt-12 mb-10 max-w-2xl mx-auto">
          <HiSearch className="absolute left-7 top-1/2 -translate-y-1/2 text-blue-500 size-8 opacity-50" />
          <input 
            className="w-full pl-20 pr-8 py-7 bg-slate-50 border border-slate-100 rounded-[35px] outline-none text-xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-inner" 
            placeholder="Ej: Ibuprofeno 600mg" 
          />
        </div>

        <div className="flex flex-col items-center gap-4">
          <button className="bg-blue-600 text-white px-16 py-5 rounded-[25px] font-black text-xl shadow-2xl shadow-blue-200 hover:scale-105 active:scale-95 transition-all">
            Realizar Búsqueda
          </button>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
            Presiona Enter para buscar resultados rápidamente
          </p>
        </div>
      </div>
    </div>
  );
}