"use client";

import { ReactNode, useState, useRef, useEffect, useMemo } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiCloseLine,
  RiSearchLine,
} from "react-icons/ri";

interface FormInputProps {
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (val: string) => void;
  icon?: ReactNode;
  hint?: string;
  className?: string;
}

export function FormInput({
  label,
  placeholder,
  type = "text",
  required = false,
  value,
  onChange,
  icon,
  hint,
  className = "",
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={`group flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-bold text-gray-700 flex items-center gap-1 ml-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        {icon && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 group-focus-within:text-blue-600 transition-colors">
            {icon}
          </span>
        )}

        <input
          type={isPassword ? (showPassword ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full h-[58px] rounded-2xl border-2 border-transparent bg-gray-100/80 ${
            icon ? "pl-12" : "pl-6"
          } pr-12 text-gray-900 placeholder-gray-500 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-5 text-gray-400 hover:text-blue-600 transition-colors"
          >
            {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
          </button>
        )}
      </div>

      {hint && (
        <p className="text-[10px] text-gray-400 font-medium ml-1">{hint}</p>
      )}
    </div>
  );
}

export function FormSelect({
  label,
  options,
  required = false,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: { label: string; value: string }[];
  required?: boolean;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 0,
  });
  const [openUp, setOpenUp] = useState(false);

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 20;
      const menuMinHeight = 250;
      const spaceBelow = window.innerHeight - rect.bottom - padding;
      const spaceAbove = rect.top - padding;

      // Decidimos si abrir hacia arriba o hacia abajo
      const shouldOpenUp =
        spaceBelow < menuMinHeight && spaceAbove > spaceBelow;

      setOpenUp(shouldOpenUp);
      setCoords({
        top: shouldOpenUp
          ? rect.top + window.scrollY - 8
          : rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
        maxHeight: shouldOpenUp
          ? Math.max(spaceAbove, 180)
          : Math.max(spaceBelow, 180),
      });
    }
  };

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const portalMenu = document.getElementById("form-select-portal-menu");
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        portalMenu &&
        !portalMenu.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      updatePosition();
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setSearchTerm("");
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div
      className={`flex flex-col gap-2 relative ${className}`}
      ref={containerRef}
    >
      <label className="text-sm font-extrabold text-gray-700 flex items-center gap-1 ml-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-[58px] rounded-2xl border-2 px-6 text-gray-900 font-bold transition-all cursor-pointer flex justify-between items-center gap-2
          ${isOpen ? "bg-white border-blue-600 ring-4 ring-blue-50 shadow-sm" : "bg-gray-100/80 border-transparent hover:bg-gray-200/60"}
        `}
      >
        <span
          className={`truncate ${!selectedOption?.value ? "text-gray-400" : "text-black"}`}
        >
          {selectedOption ? selectedOption.label : "Seleccione un grupo..."}
        </span>
        <RiArrowDownSLine
          className={`shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180 text-blue-600" : "text-gray-400"}`}
          size={22}
        />
      </div>

      {isOpen && (
        <Portal>
          <div
            id="form-select-portal-menu"
            style={{
              position: "absolute",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              maxHeight: `${coords.maxHeight}px`,
              transform: openUp ? "translateY(-100%)" : "none",
            }}
            className="bg-white border border-gray-100 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
          >
            {/* Buscador Fijo */}
            <div className="p-3 border-b border-gray-100 shrink-0 bg-white">
              <div className="relative flex items-center">
                <RiSearchLine
                  className="absolute left-4 text-blue-600"
                  size={18}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-blue-50/50 border border-blue-100 rounded-xl py-3 pl-11 pr-10 text-sm font-bold text-black outline-none focus:bg-white focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Lista con Scroll de Alto Contraste */}
            <div className="overflow-y-auto p-2 custom-select-scroll flex-1 bg-white">
              {filteredOptions.length > 0 ? (
                <>
                  {filteredOptions.map((opt, index) => (
                    <div
                      key={`${opt.value}-${index}`}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`flex items-center justify-between px-4 py-3.5 text-sm font-bold rounded-xl transition-all cursor-pointer mb-1 last:mb-0
                        ${
                          value === opt.value
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                            : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                        }
                      `}
                    >
                      <span>{opt.label}</span>
                      {value === opt.value && <RiCheckLine size={18} />}
                    </div>
                  ))}
                  <div className="h-4 shrink-0" />{" "}
                  {/* Espacio final mejorado */}
                </>
              ) : (
                <div className="py-10 text-center text-gray-400 text-sm font-bold">
                  No se encontraron resultados
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}

      <style jsx global>{`
        /* Scrollbar con más color y presencia */
        .custom-select-scroll::-webkit-scrollbar {
          width: 10px;
          display: block !important;
        }

        .custom-select-scroll::-webkit-scrollbar-track {
          background: #f1f5f9; /* Fondo grisáceo para que resalte el thumb */
          border-radius: 12px;
          margin: 12px 6px;
        }

        .custom-select-scroll::-webkit-scrollbar-thumb {
          background: #3b82f6; /* Azul vibrante para que se note */
          border-radius: 12px;
          border: 3px solid #f1f5f9; /* Efecto de separación del borde */
          min-height: 45px;
        }

        .custom-select-scroll::-webkit-scrollbar-thumb:hover {
          background: #1d4ed8;
        }

        @media (max-width: 768px) {
          .custom-select-scroll {
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </div>
  );
}

import { createPortal } from "react-dom";

function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
