import React, { useState, useMemo, useRef, useEffect } from "react";
import { RiSearchLine, RiCloseLine } from "react-icons/ri";
import { motion, AnimatePresence } from "framer-motion"; // Para la animación
import { cn } from "@/modules/core/utils/ui";

interface Props {
  title: string;
  items: string[];
  selectedItem: string | null;
  onConfirm: (item: string | null) => void;
  onClose: () => void;
  hintText?: string;
}

export const ListFilterDialog = ({
  title,
  items,
  selectedItem: initialSelection,
  onConfirm,
  onClose,
  hintText = "Buscar",
}: Props) => {
  const [selected, setSelected] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera del dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, items]);

  return (
    /* Cambiamos el contenedor a absoluto para que se posicione respecto al padre */
    <div className="absolute top-full left-0 mt-2 z-[100] w-[320px]">
      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-white rounded-[26px] p-5 shadow-2xl border border-gray-100 flex flex-col gap-4 origin-top-left"
      >
        {/* Título */}
        <div className="flex justify-between items-center">
          <h2 className="text-[18px] font-bold text-[#202224]">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RiCloseLine size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <RiSearchLine
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            autoFocus // Para que puedas escribir apenas abras
            type="text"
            placeholder={hintText}
            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#516EFA]/20 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Lista de Items */}
        <div className="bg-[#EBEBEB] rounded-xl p-2 max-h-[250px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
          <button
            onClick={() => setSelected(null)}
            className={cn(
              "w-full py-3 px-4 rounded-lg text-left text-sm font-medium transition-all",
              selected === null
                ? "bg-[#516EFA] text-white shadow-md"
                : "bg-[#C5C5C5] text-[#202224] hover:bg-gray-400",
            )}
          >
            Todos
          </button>

          {filteredItems.map((item) => (
            <button
              key={item}
              onClick={() => setSelected(item)}
              className={cn(
                "w-full py-3 px-4 rounded-lg text-left text-sm font-medium transition-all",
                selected === item
                  ? "bg-[#516EFA] text-white shadow-md"
                  : "bg-[#C5C5C5] text-[#202224] hover:bg-gray-400",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Botón de Acción */}
        <button
          onClick={() => {
            onConfirm(selected);
            onClose();
          }}
          className="w-full bg-[#516EFA] hover:bg-[#3f57cc] text-white font-bold py-3 rounded-xl transition-colors shadow-lg active:scale-[0.95]"
        >
          Aceptar
        </button>
      </motion.div>
    </div>
  );
};
