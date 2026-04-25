"use client";

import { ReactNode } from "react";
import { RiArrowLeftLine, RiCloseLine } from "react-icons/ri";

interface MultiStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  backLabel?: string;
  cancelLabel?: string;
  children: ReactNode;
  isSubmitting?: boolean;
}

export function MultiStepModal({
  isOpen,
  onClose,
  title,
  currentStep,
  totalSteps,
  onBack,
  onContinue,
  continueLabel = "Continuar",
  backLabel = "Regresar",
  cancelLabel = "Cancelar",
  children,
  isSubmitting = false,
}: MultiStepModalProps) {
  if (!isOpen) return null;

  return (
    // Se agregó items-center y justify-center con p-2 para móviles
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      {/* AJUSTE PRINCIPAL: 
        - w-[95%] para que no toque los bordes en móvil.
        - max-h-[95vh] para dar más aire.
        - overflow-hidden para que el footer y header se queden quietos.
      */}
      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] w-[95%] md:w-full max-w-5xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh] relative overflow-hidden">
        {/* Header - Ajustado padding para móviles */}
        <div className="flex items-center justify-between p-5 md:p-8 shrink-0 border-b border-gray-50">
          <h2 className="text-xl md:text-2xl font-black text-blue-600 tracking-tight line-clamp-1">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-800"
          >
            <RiCloseLine size={24} className="md:w-7 md:h-7" />
          </button>
        </div>

        {/* Contenido - Ajustado para que el scroll sea interno y no rompa el modal
         */}
        <div className="px-5 md:px-8 py-4 md:pb-10 flex-1 overflow-y-auto custom-scrollbar">
          <div className="w-full h-full">{children}</div>
        </div>

        {/* Footer - Responsivo: los botones se apilan en móviles si es necesario */}
        {/* Acciones del Footer - Ajustado para mantener fila en móvil */}
        <div className="p-4 md:p-8 border-t border-gray-50 flex flex-row items-center gap-2 md:gap-4 shrink-0">
          {/* Botón Principal (Crear/Continuar) */}
          <button
            onClick={onContinue}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none order-2 sm:order-1 bg-blue-600 text-white px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[12px] md:text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {isSubmitting ? "Cargando..." : continueLabel}
          </button>

          {/* Botón Secundario (Regresar/Cancelar) */}
          {currentStep > 1 ? (
            <button
              onClick={onBack}
              className="flex-1 sm:flex-none order-1 sm:order-2 bg-gray-200 text-gray-600 px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[12px] md:text-sm hover:bg-gray-300 active:scale-95 transition-all flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap"
            >
              <RiArrowLeftLine className="shrink-0" />
              <span className="truncate">{backLabel}</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none order-1 sm:order-2 bg-gray-100 text-gray-400 px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[12px] md:text-sm hover:bg-gray-200 hover:text-gray-600 active:scale-95 transition-all whitespace-nowrap"
            >
              {cancelLabel}
            </button>
          )}

          {/* Indicador de Paso - Solo visible desde tablets para no apretar el footer */}
          <div className="hidden lg:flex ml-auto gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i + 1 === currentStep ? "w-8 bg-blue-600" : "w-2 bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        @media (min-width: 768px) {
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
        }
      `}</style>
    </div>
  );
}
