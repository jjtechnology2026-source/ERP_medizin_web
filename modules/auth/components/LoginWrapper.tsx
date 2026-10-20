interface LoginWrapperProps {
  children: React.ReactNode;
}

export default function LoginWrapper({ children }: LoginWrapperProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-white overflow-x-hidden p-4">
      {/* Fondo de marca (degradado Mara POS) */}
      <div className="absolute top-0 left-0 h-1/2 w-full brand-gradient z-0"></div>

      {/* Header con Logo CENTRADO */}
      <div className="absolute top-0 left-0 w-full p-12 flex justify-center items-center z-20">
        <img src="/mara-logo-light.svg" alt="Mara POS · Agiliza, controla y escala" className="w-[230px] sm:w-[270px] h-auto object-contain" />
      </div>

      {/* Contenedor del Formulario (Más ancho) */}
      <div className="relative z-10 w-full max-w-xl px-4 mt-20">
        <div className="bg-white rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.15)] p-10 md:p-14 border border-gray-100">{children}</div>
      </div>

      {/* Versión del sistema */}
      <div className="absolute bottom-4 left-0 w-full text-center z-20">
        <p className="text-[11px] text-slate-400 font-medium">
          Mara POS · v{process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
        </p>
      </div>
    </div>
  );
}
