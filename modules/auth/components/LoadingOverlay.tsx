interface LoadingOverlayProps {
  message?: string;
  subtext?: string;
}

export default function LoadingOverlay({
  message = "Cargando...",
}: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#005eff] text-white backdrop-blur-md px-6 py-12">
      <div className="flex flex-col items-center gap-6 rounded-4xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-slate-950/50">
        <div className="flex items-center justify-center rounded-full bg-white/10 p-4">
          <img src="/Logo.svg" alt="Medizin Logo" className="h-16 w-16 object-contain" />
        </div>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-white/10 animate-pulse" />
          <div className="w-16 h-16 border-4 border-white/10 border-t-[#38b6ff] rounded-full animate-spin" />
        </div>

        <div className="text-center">
          <h3 className="text-xl font-black tracking-tight">{message}</h3>
        </div>
      </div>
    </div>
  );
}
