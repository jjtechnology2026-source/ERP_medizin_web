import { useState } from "react";
import { HiCloudUpload, HiOutlineChevronDown, HiOutlineCamera, HiOutlineDocumentDownload, HiOutlineTable } from "react-icons/hi";

export default function CreateProductPage({ setView }: any) {
  const [selectedUnit, setSelectedUnit] = useState('und');

  return (
    <div className="w-full max-w-[1600px] flex flex-col space-y-4">
      <h1 className="text-3xl font-black text-blue-600 px-4">Crear Producto</h1>
      
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-10">
        <div className="flex gap-6 mb-10 text-[11px] font-black text-blue-600 uppercase tracking-widest">
          <button onClick={() => setView('LIST')} className="hover:underline flex items-center gap-1">‹ Regresar</button>
          <button className="flex items-center gap-1 hover:underline"><HiOutlineDocumentDownload size={16}/> Plantilla Excel</button>
          <button className="flex items-center gap-2 bg-blue-50 px-4 py-1.5 rounded-2xl hover:bg-blue-100 transition-colors">
            <HiOutlineTable size={16}/> Carga Masiva Excel
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* COLUMNA IZQUIERDA */}
          <div className="space-y-8">
            <div className="space-y-4">
              <button className="bg-slate-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                <HiOutlineCamera size={16} /> Cargar Imágenes
              </button>
              <h2 className="text-2xl font-black text-blue-600">Contenido Multimedia</h2>
            </div>

            <div className="border-4 border-dashed border-slate-50 rounded-[40px] py-24 flex flex-col items-center justify-center bg-slate-50/30">
              <HiCloudUpload size={40} className="text-blue-500 mb-4 opacity-50" />
              <button className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black text-sm shadow-xl shadow-blue-100">Subir Archivos</button>
            </div>

            <div className="space-y-5">
              <InputField label="Categoría" placeholder="Seleccione una categoría" isSelect />
              <InputField label="Subcategorías" placeholder="Seleccione una subcategoría" isSelect />
            </div>
          </div>

          {/* COLUMNA DERECHA - LOS CAMPOS QUE FALTABAN */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-blue-600 mb-8">Información del Producto</h2>
            
            <div className="grid grid-cols-1 gap-5">
              <InputField label="Código de barras" placeholder="ej: 12345678" required />
              <InputField label="Marca" placeholder="ej: marca" required />
              <InputField label="Principio activo" placeholder="ej: Carbidopa / Levodopa" required />
              <InputField label="Nombre comercial" placeholder="Coloca el nombre" required />
              <InputField label="Cantidad" placeholder="Cantidad de presentación" required />
              
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Presentación: *</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Frasco', 'Tabletas', 'Pastillas', 'Capsulas', 'Empaque'].map(opt => (
                    <div key={opt} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 hover:bg-white hover:border-blue-200 transition-all cursor-pointer">
                      <div className="size-4 rounded-full border-2 border-slate-300" /> {opt}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <InputField label="Dosis" placeholder="ej: 100" required />
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Unidad métrica: *</label>
                  <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                    {['und', 'ml', 'l', 'cc', 'mg', 'gr', 'mcg'].map(u => (
                      <button 
                        key={u} 
                        onClick={() => setSelectedUnit(u)}
                        className={`flex-1 px-2 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${selectedUnit === u ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Descripción: *</label>
                <textarea 
                  className="w-full px-6 py-4 bg-slate-50 rounded-[24px] outline-none border border-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 text-sm min-h-[120px]" 
                  placeholder="Escribe la descripción aquí..."
                />
              </div>
            </div>

            <div className="flex gap-4 pt-10 sticky bottom-0 bg-white py-4 border-t border-slate-50">
              <button className="flex-1 py-5 bg-blue-600 text-white rounded-[24px] font-black text-lg shadow-2xl shadow-blue-100">Guardar Producto</button>
              <button onClick={() => setView('LIST')} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[24px] font-black text-lg">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, placeholder, required, isSelect }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black text-slate-400 uppercase ml-1">
        {label}: {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input 
          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 text-sm transition-all" 
          placeholder={placeholder} 
        />
        {isSelect && <HiOutlineChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" />}
      </div>
    </div>
  );
}