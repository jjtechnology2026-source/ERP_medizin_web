"use client";

import React from "react";
import { useState, useEffect, useCallback } from "react";
import { RiCalendarLine, RiCloseLine, RiSearchLine } from "react-icons/ri";
import { FilterContainer, MultiSelectFilter } from "./FilterSystem";

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "date-range" | "search" | "date";
  options?: (string | { label: string; value: string })[];
  endpoint?: string;
  optionKey?: string;
  valueKey?: string;
}

const getNestedValue = (obj: any, path: string) => {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
};

interface FilterGeneralProps<T> {
  config?: FilterConfig[];
  data?: T[];
  onFilterChange: (filters: Record<string, any>) => void;
  className?: string;
  onResetRef?: (resetFn: () => void) => void;
}

export function FilterGeneral<T>({
  config,
  data,
  onFilterChange,
  className,
  onResetRef,
}: FilterGeneralProps<T>) {
  const [internalFilters, setInternalFilters] = useState<Record<string, any>>(
    {},
  );

  const handleReset = useCallback(() => {
    setInternalFilters({});
  }, []);

  // Expose handleReset so the parent toolbar can trigger it
  useEffect(() => {
    onResetRef?.(handleReset);
  }, [handleReset, onResetRef]);

  useEffect(() => {
    onFilterChange(internalFilters);
  }, [internalFilters, onFilterChange]);

  const toggleSelect = (key: string, val: string, allOptions?: string[]) => {
    setInternalFilters((prev) => {
      const current = prev[key];
      const isAll = current === undefined || current === null;

      let nextArray: string[];

      if (isAll) {
        // De "Todos" a "Seleccion de uno"
        nextArray = [val];
      } else {
        const currentArray = (current as string[]) || [];
        if (currentArray.includes(val)) {
          nextArray = currentArray.filter((i) => i !== val);
        } else {
          nextArray = [...currentArray, val];
        }
      }

      // Si la nueva seleccion es igual a todas las opciones disponibles, mejor resetear a "Todos"
      if (allOptions && nextArray.length === allOptions.length) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [key]: nextArray };
    });
  };

  const toggleAllSelect = (key: string) => {
    setInternalFilters((prev) => {
      const isAll = prev[key] === undefined || prev[key] === null;

      if (isAll) {
        // De "Todos" a "Ninguno"
        return { ...prev, [key]: [] };
      } else {
        // De cualquier otro estado a "Todos"
        const { [key]: _, ...rest } = prev;
        return rest;
      }
    });
  };

  const handleDateChange = (
    key: string,
    field: "start" | "end",
    value: string,
  ) => {
    setInternalFilters((prev) => {
      const currentRange = prev[key] || { start: "", end: "" };
      return { ...prev, [key]: { ...currentRange, [field]: value } };
    });
  };

  const resetDate = (key: string) => {
    setInternalFilters((prev) => ({ ...prev, [key]: { start: "", end: "" } }));
  };

  return (
    <FilterContainer onReset={handleReset} className={className}>
      {config?.map((field) => {
        if (field.type === "select") {
          // Si hay endpoint, procesamos la carga
          if (field.endpoint) {
            return (
              <DynamicSelectFilter
                key={field.key}
                field={field}
                internalFilters={internalFilters}
                toggleSelect={toggleSelect}
                toggleAllSelect={toggleAllSelect}
              />
            );
          }

          if (field.options) {
            const selectedValues =
              (internalFilters[field.key] as string[]) || undefined;
            return (
              <MultiSelectFilter
                key={field.key}
                label={field.label}
                options={field.options}
                selectedValues={selectedValues}
                onToggle={(v) =>
                  toggleSelect(
                    field.key,
                    v,
                    field.options!.map((o) =>
                      typeof o === "string" ? o : o.value,
                    ),
                  )
                }
                onToggleAll={() => toggleAllSelect(field.key)}
              />
            );
          }

          if (data && data.length > 0) {
            const extractedOptions = Array.from(
              new Set(data.map((item) => getNestedValue(item, field.key))),
            )
              .filter((v) => v !== undefined && v !== null && v !== "")
              .map(String)
              .sort();

            if (extractedOptions.length > 0) {
              const selectedValues =
                (internalFilters[field.key] as string[]) || undefined;
              return (
                <MultiSelectFilter
                  key={field.key}
                  label={field.label}
                  options={extractedOptions}
                  selectedValues={selectedValues}
                  onToggle={(v) => toggleSelect(field.key, v, extractedOptions)}
                  onToggleAll={() => toggleAllSelect(field.key)}
                />
              );
            }
          }
        } else if (field.type === "date-range") {
          const range = (internalFilters[field.key] as {
            start: string;
            end: string;
          }) || { start: "", end: "" };
          return (
            <div
              key={field.key}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all"
            >
              <RiCalendarLine className="text-gray-400" />
              <input
                type="date"
                placeholder="Desde"
                className="text-xs font-medium text-gray-600 bg-transparent outline-none w-[110px]"
                value={range.start}
                onChange={(e) =>
                  handleDateChange(field.key, "start", e.target.value)
                }
              />
              <span className="text-gray-300">-</span>
              <input
                type="date"
                placeholder="Hasta"
                className="text-xs font-medium text-gray-600 bg-transparent outline-none w-[110px]"
                value={range.end}
                onChange={(e) =>
                  handleDateChange(field.key, "end", e.target.value)
                }
                min={range.start}
              />
              {(range.start || range.end) && (
                <button
                  onClick={() => resetDate(field.key)}
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  <RiCloseLine size={16} />
                </button>
              )}
            </div>
          );
        } else if (field.type === "search") {
          return (
            <div
              key={field.key}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all min-w-[200px]"
            >
              <RiSearchLine className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder={field.label}
                className="text-xs font-medium text-gray-600 bg-transparent outline-none w-full"
                value={internalFilters[field.key] || ""}
                onChange={(e) =>
                  setInternalFilters((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
              />
              {internalFilters[field.key] && (
                <button
                  onClick={() =>
                    setInternalFilters((prev) => {
                      const { [field.key]: _, ...rest } = prev;
                      return rest;
                    })
                  }
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  <RiCloseLine size={16} />
                </button>
              )}
            </div>
          );
        } else if (field.type === "date") {
          return (
            <div
              key={field.key}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all"
            >
              <RiCalendarLine className="text-gray-400 shrink-0" />
              <input
                type="date"
                className="text-xs font-medium text-gray-600 bg-transparent outline-none"
                value={internalFilters[field.key] || ""}
                onChange={(e) =>
                  setInternalFilters((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
              />
              {internalFilters[field.key] && (
                <button
                  onClick={() =>
                    setInternalFilters((prev) => {
                      const { [field.key]: _, ...rest } = prev;
                      return rest;
                    })
                  }
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  <RiCloseLine size={16} />
                </button>
              )}
            </div>
          );
        }
        return null;
      })}
    </FilterContainer>
  );
}

// Subcomponente para manejar fetching de opciones
import { useApiQuery } from "@/modules/core/hooks/useApi";

function DynamicSelectFilter({
  field,
  internalFilters,
  toggleSelect,
  toggleAllSelect,
}: {
  field: FilterConfig;
  internalFilters: Record<string, any>;
  toggleSelect: (key: string, val: string, all: string[]) => void;
  toggleAllSelect: (key: string) => void;
}) {
  const { data, isLoading } = useApiQuery<any[]>(
    [`filter-opts-${field.key}`],
    field.endpoint || "",
  );

  // Mapeo enriquecido: extrae label y value si se configuran
  const options = React.useMemo(() => {
    if (!data) return [];
    if (field.optionKey) {
      // Si hay optionKey y valueKey, creamos objetos {label, value}
      const mapped = data.map((item) => {
        const label = String(item[field.optionKey!] || "");
        const value = field.valueKey
          ? String(item[field.valueKey!] || "")
          : label;
        return { label, value };
      });

      // Eliminar duplicados por valor
      const seen = new Set();
      return mapped.filter((item) => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      });
    }
    // Si no hay optionKey, asumimos array de strings simples
    return Array.from(new Set(data.map(String)));
  }, [data, field.optionKey, field.valueKey]);

  // -- Auto-Select Removed --
  // Ahora manejamos "TODOS" mediante el estado 'undefined'. No necesitamos rellenar el estado con todas las opciones.

  const selectedValues = (internalFilters[field.key] as string[]) || undefined;

  if (isLoading) {
    return (
      <div className="text-xs text-gray-400 px-3 py-2">
        Cargando opciones...
      </div>
    );
  }

  // Extraer solo los VALORES para el toggle
  const allValues = options.map((opt) =>
    typeof opt === "string" ? opt : opt.value,
  );

  return (
    <MultiSelectFilter
      key={field.key}
      label={field.label}
      options={options}
      selectedValues={selectedValues}
      onToggle={(v) => toggleSelect(field.key, v, allValues)}
      onToggleAll={() => toggleAllSelect(field.key)}
    />
  );
}
