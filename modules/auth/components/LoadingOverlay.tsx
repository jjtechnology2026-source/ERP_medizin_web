interface LoadingOverlayProps {
  message?: string;
  subtext?: string;
}

export default function LoadingOverlay({
  message = "Cargando...",
  subtext,
}: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          {/* Spinner Exterior */}
          <div className="w-24 h-24 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
          
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/Logo.svg" alt="Logo" className="w-10 h-10 object-contain animate-pulse" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{message}</h3>
          {subtext && <p className="text-slate-400 font-bold text-sm">{subtext}</p>}
        </div>
      </div>
      
      {/* Barra de progreso decorativa abajo */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-50">
        <div className="h-full bg-blue-600 animate-loading-bar" />
      </div>
    </div>
  );
}
