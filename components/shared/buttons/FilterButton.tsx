import React, { useState, useRef, useEffect } from "react";
import { RiArrowDownSLine, RiCalendarLine } from "react-icons/ri";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/modules/core/utils/ui";
import { ListFilterDialog } from "../dialogs/ListFilterDialog";
import { DateRangeFilterDialog } from "../dialogs/DateRangerFilterDialog";

// Definimos la estructura de las Props
interface FilterButtonProps {
  label: string;
  title: string;
  isDate?: boolean;
  items?: string[];
  selectedItem?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  // Aquí definimos que onConfirm recibe un string o null,
  // y opcionalmente un segundo string para fechas.
  onConfirm: (val1: string | null, val2?: string | null) => void;
  hintText?: string;
}

export const FilterButton = ({
  label,
  title,
  isDate,
  items = [],
  selectedItem,
  startDate,
  endDate,
  onConfirm,
  hintText,
}: FilterButtonProps) => {
  // <-- Usamos la Interface aquí
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const getDisplayText = () => {
    if (isDate) {
      return startDate && endDate ? `${startDate} - ${endDate}` : "Seleccionar";
    }
    return selectedItem || "Todos";
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "px-6 py-2.5 bg-white border border-gray-500 rounded-full flex items-center gap-2 transition-all hover:bg-gray-50 active:scale-95",
          isOpen && "ring-2 ring-blue-500/20 border-blue-500 shadow-md",
        )}
      >
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <RiArrowDownSLine
          className={cn(
            "text-gray-400 transition-transform duration-300",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed top-0 left-0 w-full h-full z-[100]"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="absolute"
              style={{
                top: containerRef.current?.getBoundingClientRect().bottom ?? 0,
                left: containerRef.current?.getBoundingClientRect().left ?? 0,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isDate ? (
                <DateRangeFilterDialog
                  startDate={startDate || null}
                  endDate={endDate || null}
                  onConfirm={(s: string | null, e: string | null) => {
                    onConfirm(s, e);
                    setIsOpen(false);
                  }}
                  onClose={() => setIsOpen(false)}
                />
              ) : (
                <ListFilterDialog
                  title={title}
                  items={items}
                  selectedItem={selectedItem || null}
                  onConfirm={(val: string | null) => {
                    onConfirm(val);
                    setIsOpen(false);
                  }}
                  onClose={() => setIsOpen(false)}
                  hintText={hintText}
                />
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
