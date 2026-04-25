"use client";

import React from "react";
import { ReactNode, useState, useEffect } from "react";
import {
  RiSearchLine,
  RiAddLine,
  RiEdit2Line,
  RiDeleteBin6Line,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiEyeLine,
  RiArrowDownSLine,
  RiFilterOffLine,
} from "react-icons/ri";
import { useDataTable } from "./useDataTable";

interface Column<T> {
  header: string;
  key: keyof T | string;
  render?: (item: T) => ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
}

interface HeaderAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  className?: string;
}

interface DataTableProps<
  T,
  F extends Record<string, any> = Record<string, any>,
> {
  data: T[];
  columns: Column<T>[];
  itemsPerPage?: number;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  actions?: HeaderAction[];
  searchLabel?: string;
  externalFilters?: F;
  filterFn?: (item: T, filter: F, search: string) => boolean;
  filterComponent?: ReactNode;
  loading?: boolean;
  expandableRowRender?: (item: T) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  error?: any;
  onResetFilters?: () => void;
  renderFooter?: () => ReactNode;
}

export function DataTable<T, F extends Record<string, any>>({
  data,
  columns,
  itemsPerPage = 10,
  onEdit,
  onDelete,
  onView,
  actions = [],
  searchLabel = "Buscar en la lista...",
  externalFilters,
  filterFn,
  filterComponent,
  loading = false,
  expandableRowRender,
  emptyTitle = "No se encontraron datos",
  emptyDescription = "Intenta ajustar los filtros o la búsqueda",
  error,
  onResetFilters,
  renderFooter,
}: DataTableProps<T, F>) {
  // --- Estados locales ---
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // --- Uso de la logica del hook useDataTable ---
  const {
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
  } = useDataTable<T, F>(data, itemsPerPage, externalFilters, filterFn);

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        {/* --- HEADER: Buscador, Filtros y Acciones --- */}
        <div className="p-3 md:p-4 bg-gray-50/50 border-b border-gray-100 rounded-t-2xl">
          <div className="hidden md:flex flex-wrap items-center gap-y-4 gap-x-3">
            <div className="relative min-w-[200px] flex-1 max-w-[300px] shrink-0">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
              <input
                type="text"
                placeholder={searchLabel}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm text-gray-700 placeholder-gray-400"
              />
            </div>

            {filterComponent && (
              <div className="hidden lg:block w-px h-6 bg-gray-200 shrink-0" />
            )}

            <div className="flex flex-wrap items-center gap-2">
              {filterComponent && (
                <div className="flex flex-wrap items-center gap-2">
                  {filterComponent}
                </div>
              )}

              {onResetFilters && (
                <button
                  onClick={onResetFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] lg:text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all active:scale-95 whitespace-nowrap"
                >
                  <RiFilterOffLine size={15} />
                  <span className="hidden sm:inline">Limpiar filtros</span>
                  <span className="sm:hidden">Limpiar</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-xl font-semibold transition-all text-xs lg:text-sm active:scale-95 whitespace-nowrap ${
                    action.className ||
                    "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {action.icon || <RiAddLine size={16} />}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            <div className="relative w-full">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
              <input
                type="text"
                placeholder={searchLabel}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm text-gray-700"
              />
            </div>

            {filterComponent && (
              <div className="flex flex-wrap items-center gap-2 w-full">
                <div className="flex-1 min-w-[120px]">{filterComponent}</div>
                {onResetFilters && (
                  <button
                    onClick={onResetFilters}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 active:scale-95"
                  >
                    <RiFilterOffLine size={14} />
                  </button>
                )}
              </div>
            )}

            {actions.length > 0 && (
              <div className="grid grid-cols-2 gap-2 w-full">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all text-xs active:scale-95 ${
                      action.className || "bg-blue-600 text-white"
                    } ${actions.length === 1 ? "col-span-2" : ""}`}
                  >
                    {action.icon || <RiAddLine size={16} />}
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="w-full">
          <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar rounded-b-2xl">
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 z-10">
                <tr className="bg-blue-600">
                  {expandableRowRender && <th className="py-4 px-4 w-10"></th>}
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className={
                        col.headerClassName ||
                        `py-4 px-6 text-[11px] font-black text-blue-50 uppercase tracking-widest ${
                          col.align === "center"
                            ? "text-center"
                            : col.align === "right"
                              ? "text-right"
                              : "text-left"
                        }`
                      }
                    >
                      {col.header}
                    </th>
                  ))}
                  <th className="py-4 px-6 text-[11px] font-black text-blue-50 uppercase tracking-widest text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={columns.length + (expandableRowRender ? 2 : 1)}
                      className="py-20 text-center text-gray-400"
                    >
                      <div className="flex flex-col items-center gap-2 animate-pulse">
                        <div className="size-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-sm font-medium">
                          Cargando datos...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item, rowIdx) => (
                    <React.Fragment key={rowIdx}>
                      <tr className="hover:bg-blue-50/50 transition-colors group">
                        {expandableRowRender && (
                          <td className="py-4 px-4">
                            <button
                              onClick={() => {
                                const newSet = new Set(expandedRows);
                                if (newSet.has(rowIdx)) newSet.delete(rowIdx);
                                else newSet.add(rowIdx);
                                setExpandedRows(newSet);
                              }}
                              className="p-1 hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <RiArrowRightSLine
                                className={`size-5 text-gray-400 transition-transform duration-200 ${expandedRows.has(rowIdx) ? "rotate-90 text-blue-600" : ""}`}
                              />
                            </button>
                          </td>
                        )}
                        {columns.map((col, colIdx) => (
                          <td
                            key={colIdx}
                            className={
                              col.className ||
                              `py-4 px-6 text-sm text-gray-600 ${
                                col.align === "center"
                                  ? "text-center"
                                  : col.align === "right"
                                    ? "text-right"
                                    : "text-left"
                              }`
                            }
                          >
                            <div
                              className={
                                colIdx === 0 ? "font-bold text-gray-900" : ""
                              }
                            >
                              {col.render
                                ? col.render(item)
                                : (getNestedValue(
                                    item,
                                    col.key as string,
                                  ) as ReactNode)}
                            </div>
                          </td>
                        ))}
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-1 transition-opacity">
                            {onView && (
                              <ActionButton
                                icon={<RiEyeLine size={18} />}
                                onClick={() => onView?.(item)}
                                color="text-[#dc2b1a] hover:bg-red-50"
                              />
                            )}
                            {onEdit && (
                              <ActionButton
                                icon={<RiEdit2Line />}
                                onClick={() => onEdit?.(item)}
                                color="text-blue-600"
                              />
                            )}
                            {onDelete && (
                              <ActionButton
                                icon={<RiDeleteBin6Line />}
                                onClick={() => onDelete?.(item)}
                                color="text-red-500"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandableRowRender && expandedRows.has(rowIdx) && (
                        <tr>
                          <td
                            colSpan={columns.length + 2}
                            className="p-0 bg-gray-50/50"
                          >
                            <div className="p-6 animate-in slide-in-from-top-2 duration-200 border-x-4 border-l-blue-600 border-r-transparent">
                              {expandableRowRender(item)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}

                {!loading && currentItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + (expandableRowRender ? 2 : 1)}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
                        <div className="bg-gray-50 p-4 rounded-full">
                          <RiSearchLine size={32} className="text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">
                          {emptyTitle}
                        </h3>
                        <p className="text-sm text-gray-400 max-w-xs mx-auto">
                          {emptyDescription}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="py-20 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2 animate-pulse">
                  <div className="size-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Cargando datos...</span>
                </div>
              </div>
            ) : (
              currentItems.map((item, rowIdx) => (
                <div key={rowIdx} className="bg-white">
                  <div className="p-5 flex flex-col gap-4">
                    {columns.map((col, colIdx) => (
                      <div
                        key={colIdx}
                        className="flex justify-between items-center text-sm"
                      >
                        <span className="font-black text-gray-400 uppercase text-[10px] tracking-tighter">
                          {col.header}
                        </span>
                        <span
                          className={`text-gray-800 ${colIdx === 0 ? "font-bold" : ""}`}
                        >
                          {col.render
                            ? col.render(item)
                            : (getNestedValue(
                                item,
                                col.key as string,
                              ) as ReactNode)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-end items-center gap-4 pt-4 border-t border-gray-50">
                      {expandableRowRender ? (
                        <button
                          onClick={() => {
                            const newSet = new Set(expandedRows);
                            if (newSet.has(rowIdx)) newSet.delete(rowIdx);
                            else newSet.add(rowIdx);
                            setExpandedRows(newSet);
                          }}
                          className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 transition-all active:scale-95 shadow-sm border ${
                            expandedRows.has(rowIdx)
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-blue-200"
                              : "bg-white text-blue-600 border-blue-100 hover:border-blue-200 hover:bg-blue-50/50"
                          }`}
                        >
                          <RiArrowDownSLine
                            className={`size-4 transition-transform ${expandedRows.has(rowIdx) ? "rotate-180" : ""}`}
                          />
                          {expandedRows.has(rowIdx) ? "Cerrar" : "Detalles"}
                        </button>
                      ) : (
                        onView && (
                          <button
                            onClick={() => onView?.(item)}
                            className="flex-1 sm:flex-none bg-[#dc2b1a] text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-red-100 active:scale-95 transition-all w-full"
                          >
                            <RiEyeLine size={16} /> Ver Farmacia
                          </button>
                        )
                      )}

                      <div className="flex gap-2 w-full sm:w-auto">
                        {onEdit && (
                          <button
                            onClick={() => onEdit?.(item)}
                            className="flex-1 sm:flex-none p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center"
                          >
                            <RiEdit2Line size={18} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete?.(item)}
                            className="flex-1 sm:flex-none p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center"
                          >
                            <RiDeleteBin6Line size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandableRowRender && expandedRows.has(rowIdx) && (
                    <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                      <div className="pt-4 border-t border-gray-100">
                        {expandableRowRender(item)}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {!loading && currentItems.length === 0 && (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
                  <div className="bg-gray-50 p-4 rounded-full">
                    <RiSearchLine size={32} className="text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {emptyTitle}
                  </h3>
                  <p className="text-sm text-gray-400 max-w-xs mx-auto">
                    {emptyDescription}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        {renderFooter && renderFooter()}
      </div>

      <Pagination
        current={currentPage}
        total={totalPages}
        start={startIndex}
        filteredCount={filteredData.length}
        itemsPerPage={itemsPerPage}
        onNext={goToNextPage}
        onPrev={goToPrevPage}
        onGoToPage={goToPage}
      />
    </div>
  );
}

function ActionButton({
  icon,
  onClick,
  color,
}: {
  icon: ReactNode;
  onClick?: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 ${color} hover:bg-gray-100 rounded-xl transition-all active:scale-90`}
    >
      {icon}
    </button>
  );
}

function Pagination({
  current,
  total,
  start,
  filteredCount,
  itemsPerPage,
  onNext,
  onPrev,
  onGoToPage,
}: any) {
  const [inputValue, setInputValue] = useState(current.toString());

  useEffect(() => {
    setInputValue(current.toString());
  }, [current]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const page = parseInt(inputValue);
    if (!isNaN(page)) {
      onGoToPage(page);
    } else {
      setInputValue(current.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputBlur();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4">
      <p className="text-xs text-gray-500 font-bold">
        Mostrando <span className="text-blue-600">{start + 1}</span> a{" "}
        <span className="text-blue-600">
          {Math.min(start + itemsPerPage, filteredCount)}
        </span>{" "}
        de {filteredCount}
      </p>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
            Ir a
          </span>
          <div className="relative group">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              className="w-12 h-9 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs font-bold text-blue-600 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={current === 1}
            onClick={onPrev}
            className="p-2 rounded-xl border border-gray-200 bg-white disabled:opacity-30 hover:bg-gray-50 shadow-sm transition-all active:scale-95"
          >
            <RiArrowLeftSLine size={20} />
          </button>
          <div className="flex items-center gap-1 font-bold text-xs">
            <span className="bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-md shadow-blue-100 min-w-[32px] text-center">
              {current}
            </span>
            <span className="text-gray-400 px-1 text-[10px] uppercase">de</span>
            <span className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg min-w-[32px] text-center">
              {total || 1}
            </span>
          </div>
          <button
            disabled={current === total || total === 0}
            onClick={onNext}
            className="p-2 rounded-xl border border-gray-200 bg-white disabled:opacity-30 hover:bg-gray-50 shadow-sm transition-all active:scale-95"
          >
            <RiArrowRightSLine size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
