import { 
  HiOutlinePencil, HiOutlineTrash, HiOutlineRefresh, 
  HiPlus, HiCloudUpload, HiSearch, HiViewGrid, HiExclamationCircle,
  HiOutlineDownload 
} from "react-icons/hi";

export default function InventoryList({ setView, stockTab, setStockTab, currentPage, setCurrentPage, itemsPerPage }: any) {
  const products = Array(45).fill({
    nombre: "Acetabiofen",
    categoria: "malestar general",
    precio: "0.02 USD",
    cantidad: "10735.0",
    descripcion: "Analgesico y antipiretico para el alivio de..."
  });

  const totalPages = Math.ceil(products.length / itemsPerPage);
  const currentItems = products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="w-full max-w-[1600px] flex flex-col space-y-4 animate-in fade-in duration-500">
      {/* HEADER DE LA PÁGINA */}
      <div className="flex justify-between items-end px-2">
        <h1 className="text-3xl font-black text-blue-600">Productos en Stock</h1>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1 text-slate-400 text-[10px] font-black uppercase hover:text-blue-600 transition-colors">
            Descargar Inventario <HiOutlineDownload size={14} />
          </button>
          <button onClick={() => setView('SEARCH_CATALOG')} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-100 hover:scale-105 transition-all">
            <HiPlus size={18} /> Crear producto
          </button>
          <button onClick={() => setView('CREATE_MANUAL')} className="flex items-center gap-2 px-6 py-2.5 bg-slate-400 text-white rounded-2xl font-black text-xs shadow-lg shadow-slate-200 hover:scale-105 transition-all">
            <HiCloudUpload size={18} /> Crear producto
          </button>
        </div>
      </div>

      {/* TARJETA BLANCA PRINCIPAL */}
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        
        {/* TABS Y BUSCADOR */}
        <div className="p-5 flex justify-between items-center border-b border-slate-50">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
            <button 
              onClick={() => setStockTab('GENERAL')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${stockTab === 'GENERAL' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
            >
              <HiViewGrid size={16} /> Stock General
            </button>
            <button 
              onClick={() => setStockTab('LOW')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${stockTab === 'LOW' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
            >
              <HiExclamationCircle size={16} /> Productos bajos en stock
            </button>
          </div>
          <div className="relative w-72">
            <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por nombre..." className="w-full pl-11 pr-4 py-2.5 bg-slate-100 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>

        {/* TABLA DE PRODUCTOS */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-50">
              <tr>
                {["Imagen", "Nombre", "Categoria", "Precio", "Cantidad", "Descripción", "Acción"].map((h) => (
                  <th key={h} className="px-8 py-5 text-[11px] font-black text-slate-900 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentItems.map((prod, i) => (
                <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-8 py-4"><div className="size-10 bg-slate-50 rounded-lg border border-slate-100" /></td>
                  <td className="px-8 py-4 font-bold text-slate-700 text-sm">{prod.nombre}</td>
                  <td className="px-8 py-4 text-slate-500 text-xs">{prod.categoria}</td>
                  <td className="px-8 py-4 font-black text-slate-800 text-xs">{prod.precio}</td>
                  <td className="px-8 py-4 font-bold text-slate-600 text-xs">{prod.cantidad}</td>
                  <td className="px-8 py-4 text-slate-400 text-[11px] max-w-xs truncate">{prod.descripcion}</td>
                  <td className="px-8 py-4 flex gap-2">
                    {/* BOTÓN 1: Editar (Azul) */}
                    <button className="p-2 text-blue-500 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-500 hover:text-white transition-all active:scale-90">
                      <HiOutlinePencil />
                    </button>
                    {/* BOTÓN 2: Actualizar Stock (Ámbar) */}
                    <button className="p-2 text-amber-500 bg-amber-50 rounded-lg border border-amber-100 hover:bg-amber-500 hover:text-white transition-all active:scale-90">
                      <HiOutlineRefresh />
                    </button>
                    {/* BOTÓN 3: Eliminar (Rojo) */}
                    <button className="p-2 text-red-500 bg-red-50 rounded-lg border border-red-100 hover:bg-red-500 hover:text-white transition-all active:scale-90">
                      <HiOutlineTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN RECUPERADA */}
        <div className="p-4 border-t border-slate-50 bg-white flex justify-between items-center">
          <p className="text-xs font-bold text-slate-400">
            Mostrando {currentItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, products.length)} de {products.length} productos
          </p>

          <div className="flex items-center gap-4">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage((page: number) => page - 1)} 
              className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-1 font-bold text-xs">
              <span className="bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-md shadow-blue-100 min-w-8 text-center">
                {currentPage}
              </span>
              <span className="text-slate-400 px-1 text-[10px] uppercase">de</span>
              <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg min-w-8 text-center">
                {totalPages || 1}
              </span>
            </div>

            <button 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage((page: number) => page + 1)} 
              className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}