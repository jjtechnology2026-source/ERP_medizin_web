"use client";
import { useEffect, useState, ReactNode } from "react";

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode; 
  zIndex?: number;    
}

export default function ModalWrapper({ isOpen, onClose, children, zIndex = 100 }: ModalWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Usamos un pequeño delay de 20ms. 
      // Esto permite que el componente se monte ANTES de disparar la transición.
      const timer = setTimeout(() => setIsAnimating(true), 20);
      return () => clearTimeout(timer);
    }

    setIsAnimating(false);
    const timeout = setTimeout(() => setIsVisible(false), 500);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex }}
    >
      {/* Backdrop: Más lento para una entrada cinemática */}
      <div 
        className={`absolute inset-0 bg-slate-900/30 backdrop-blur-lg transition-opacity duration-700 ease-in-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={onClose}
      />

      {/* Contenido: Animación "Spring" */}
      <div
        className={`relative bg-white rounded-[40px] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] overflow-hidden transform transition-all duration-500 ${
          isAnimating 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-2 scale-[0.98]'
        }`}
        style={{
          // Esta curva (Quintic) es la clave de la elegancia: suave al inicio, rápida en medio, muy lenta al final.
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}