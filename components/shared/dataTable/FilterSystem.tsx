"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  RiFilter3Line,
  RiArrowDownSLine,
  RiRestartLine,
  RiCheckLine,
  RiSearchLine,
} from "react-icons/ri";

export type FilterOption = string | { label: string; value: string };

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onToggle,
  onToggleAll,
  disabled = false,
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (val: string) => void;
  onToggleAll: () => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [searchOption, setSearchOption] = useState("");

  const normalizedOptions = useMemo(() => {
    return options
      .map((opt) => {
        if (typeof opt === "string") return { label: opt, value: opt };
        return opt;
      })
      .filter((opt) =>
        opt.label.toLowerCase().includes(searchOption.toLowerCase()),
      );
  }, [options, searchOption]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAllState = selectedValues === undefined || selectedValues === null;
  const isNoneState =
    Array.isArray(selectedValues) && selectedValues.length === 0;

  const isOptionSelected = (val: string) =>
    isAllState ||
    (Array.isArray(selectedValues) && selectedValues.includes(val));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`group flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm text-sm font-medium transition-all min-w-[140px] ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-100"
            : isOpen
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
        }`}
      >
        <RiFilter3Line className={isOpen ? "text-blue-600" : "text-gray-400"} />
        <div className="flex flex-col items-start leading-none gap-0.5 overflow-hidden">
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
            {label}
          </span>
          <span className="text-xs font-bold truncate w-full">
            {isAllState
              ? "Todos"
              : isNoneState
                ? "Ninguno"
                : `${selectedValues.length} seleccionados`}
          </span>
        </div>
        <RiArrowDownSLine
          className={`ml-1 transition-transform shrink-0 ${
            isOpen ? "rotate-180 text-blue-600" : "text-gray-400"
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 min-w-[220px]">
          <div className="p-2">
            <div className="px-2 pb-2">
              <div className="relative">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-medium focus:bg-white focus:border-blue-500 transition-all"
                  value={searchOption}
                  onChange={(e) => setSearchOption(e.target.value)}
                />
              </div>
            </div>
            <div
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors"
              onClick={onToggleAll}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  isAllState
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300"
                }`}
              >
                {isAllState && <RiCheckLine size={12} />}
              </div>
              <span className="text-sm font-bold text-gray-700">
                Seleccionar Todos
              </span>
            </div>
            <div className="my-1 border-t border-gray-100" />
            <div className="max-h-[220px] overflow-y-auto">
              {normalizedOptions.length === 0 ? (
                <p className="px-2 py-3 text-xs text-gray-400 text-center italic">
                  No hay opciones disponibles
                </p>
              ) : (
                normalizedOptions.map((opt) => {
                  const isSelected = isOptionSelected(opt.value);
                  return (
                    <div
                      key={opt.value}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                      onClick={() => onToggle(opt.value)}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && <RiCheckLine size={12} />}
                      </div>
                      <span className="text-sm text-gray-600 truncate">
                        {opt.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ""}`}>
      {children}
    </div>
  );
}
