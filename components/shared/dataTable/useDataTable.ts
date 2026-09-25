import { useState, useMemo, useEffect } from "react";

const defaultFilterFn = (item: any, filters: any, searchTerm: string) => {
  // Si no hay logica especial se ejecuta el metodo global
  return Object.values(item).some((val) =>
    String(val).toLowerCase().includes(searchTerm.toLowerCase()),
  );
};

// Para busqueda global (reutilizable dentro de filterFn)
export const searchInObject = (obj: any, searchTerm: string): boolean => {
  if (!searchTerm) return true;
  return Object.values(obj).some((val) => {
    if (val && typeof val === "object") return searchInObject(val, searchTerm);
    return String(val).toLowerCase().includes(searchTerm.toLowerCase());
  });
};

export const getNestedValue = (obj: any, path: string) => {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
};

export function useDataTable<T, F extends Record<string, any>>(
  /**
   * T: El tipo de dato de la lista (ej: Farmacia, Orden)
   * F: El tipo de estructura de los filtros (ej: { grupoId: string })
   */
  datos: T[],
  itemsPerPage: number,
  externalFilters: F = {} as F,
  filterFn: (item: T, filter: F, search: string) => boolean = defaultFilterFn,
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Logica de filtrado
  const safeData = datos || [];

  // Logica de filtrado
  const filteredData = useMemo(() => {
    return safeData.filter((item) => {
      // 1. Busqueda global
      if (searchTerm && !searchInObject(item, searchTerm)) return false;

      // 2. Filtros externos automaticos
      for (const key in externalFilters) {
        const filterValue = externalFilters[key];
        if (filterValue === undefined || filterValue === null) continue;

        const itemValue = getNestedValue(item, key);

        // A. Lógica de rango de fechas
        if (
          typeof filterValue === "object" &&
          !Array.isArray(filterValue) &&
          ("start" in filterValue || "end" in filterValue)
        ) {
          const { start, end } = filterValue as { start: string; end: string };
          if (!itemValue) return false;

          const dateVal = new Date(itemValue as string | number).getTime();

          // Parse start date
          if (start) {
            const [y, m, d] = start.split("-").map(Number);
            const startTime = new Date(y, m - 1, d, 0, 0, 0).getTime();
            if (dateVal < startTime) return false;
          }

          // Parse end date
          if (end) {
            const [y, m, d] = end.split("-").map(Number);
            const endTime = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
            if (dateVal > endTime) return false;
          }

          continue; // Pasa al siguiente filtro
        }

        // B. Lógica de filtrado por Array (Multiselect)
        if (Array.isArray(filterValue)) {
          // Si el array está vacío, el usuario desmarcó todo -> No mostrar nada
          if (filterValue.length === 0) return false;

          // Si tiene elementos, el item debe estar en el array
          if (!filterValue.includes(String(itemValue))) {
            return false;
          }
          continue;
        }

        // C. Lógica para primitivos
        if (filterValue !== "") {
          const stringFilter = String(filterValue).toLowerCase();
          const stringItem = String(itemValue).toLowerCase();

          // Si el filtro se llama "search", hacemos búsqueda parcial en todo el objeto
          if (key === "search") {
            if (!searchInObject(item, String(filterValue))) {
              return false;
            }
          } else {
            const stringFilter = String(filterValue).toLowerCase();
            const stringItem = String(itemValue).toLowerCase();
            // Para otros primitivos, mantenemos igualdad estricta
            if (stringItem !== stringFilter) {
              return false;
            }
          }
        }
      }

      // 3. Custom filter function (opcional si aun se pasa)
      if (filterFn !== defaultFilterFn) {
        return filterFn(item, externalFilters, searchTerm);
      }

      return true;
    });
  }, [safeData, externalFilters, searchTerm, filterFn]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Elementos que se mostraran en la página actual
  const currentItems = useMemo(() => {
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, startIndex, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [externalFilters, searchTerm]);

  //   const handleSearch = (value: string) => {
  //     setSearchTerm(value);
  //     setCurrentPage(1);
  //   };
  const handleSearch = (value: string) => setSearchTerm(value);

  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const goToPage = (page: number) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  };

  return {
    currentPage,
    searchTerm,
    filteredData,
    currentItems,
    totalPages,
    startIndex,
    handleSearch,
    goToNextPage,
    goToPrevPage,
    goToPage,
    getNestedValue,
  };
}
