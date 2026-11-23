"use client";
import { useState } from "react";
import {
  HiOutlineExclamationCircle,
  HiOutlinePencil,
  HiOutlineTrash,
  HiCheck,
} from "react-icons/hi";
import RecordCard from "@/components/ui/record-card";
import { taxBreakdown } from "@/modules/products/lib/pricing";
import { productTypeChipClass } from "@/modules/products/lib/catalog";
import type { Medication } from "@/modules/products/types/products.types";

interface InventoryCardListProps {
  inventory: Medication[];
  /** Current search term, only used to word the empty state. */
  searchTerm: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (med: Medication) => void;
  onDelete: (barCode: string) => void;
  formatPrice: (price: number) => string;
}

/** Which of the three stock states a product is in, with its own color. */
function stockState(med: Medication) {
  if (med.stock <= 0) return { label: "Sin stock", tone: "text-red-600" };
  if (med.stock <= med.minimum) return { label: "Stock bajo", tone: "text-amber-600" };
  return { label: "En stock", tone: "text-emerald-600" };
}

/**
 * The inventory of `TabInventory` on a phone (spec S7): the eight-column table
 * collapses into one card per product with the four fields the agent decides
 * with — name, price, stock and stock state — and the rest behind the
 * disclosure.
 *
 * Row actions are always visible and at least 44×44 (specs S3, S5): the desktop
 * table's icon buttons never depended on hover, but they were 32px and sat in a
 * row that only existed inside a horizontally scrolled table. Deleting asks for
 * a second tap on the same control instead of deleting on the first touch.
 */
export default function InventoryCardList({
  inventory,
  searchTerm,
  isLoading,
  error,
  onRetry,
  onEdit,
  onDelete,
  formatPrice,
}: InventoryCardListProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-4 py-10 text-center">
        <span className="text-sm font-bold text-red-500">{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-xl bg-blue-600 px-6 text-xs font-black text-white transition-colors active:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <svg
          className="h-9 w-9 animate-spin text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-sm font-bold text-slate-500">Cargando datos...</span>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center text-sm font-bold text-slate-400">
        {searchTerm
          ? "No se encontraron productos con ese criterio de búsqueda"
          : "No hay productos en inventario"}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {inventory.map((med, i) => {
        const state = stockState(med);
        const low = med.stock <= med.minimum;
        const breakdown = taxBreakdown(med.price, med.vat ?? 0, med.basePrice);
        const isPending = pendingDelete === med.barCode;

        return (
          <RecordCard
            key={med.barCode || i}
            title={med.name}
            subtitle={isPending ? "Toca de nuevo para eliminar" : med.barCode}
            fields={[
              { label: "Precio", value: formatPrice(med.price), emphasis: "strong" },
              {
                label: "Existencia",
                value: (
                  <span className={low ? "text-red-600" : undefined}>
                    {med.stock}
                    {low ? (
                      <HiOutlineExclamationCircle
                        size={14}
                        aria-hidden="true"
                        className="ml-1 inline align-[-2px] text-red-500"
                      />
                    ) : null}
                  </span>
                ),
                emphasis: "strong",
              },
              {
                label: "Estado",
                value: <span className={state.tone}>{state.label}</span>,
                emphasis: "strong",
              },
            ]}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => onEdit(med)}
                  aria-label={`Editar ${med.name}`}
                  title={`Editar ${med.name}`}
                  className="flex items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 transition-colors active:bg-blue-100"
                >
                  <HiOutlinePencil size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isPending) {
                      setPendingDelete(med.barCode);
                      return;
                    }
                    setPendingDelete(null);
                    onDelete(med.barCode);
                  }}
                  aria-label={
                    isPending
                      ? `Confirmar eliminación de ${med.name}`
                      : `Eliminar ${med.name}`
                  }
                  title={
                    isPending
                      ? `Confirmar eliminación de ${med.name}`
                      : `Eliminar ${med.name}`
                  }
                  className={
                    isPending
                      ? "flex items-center justify-center rounded-xl bg-red-600 text-white transition-colors active:bg-red-700"
                      : "flex items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 transition-colors active:bg-red-100"
                  }
                >
                  {isPending ? (
                    <HiCheck size={18} aria-hidden="true" />
                  ) : (
                    <HiOutlineTrash size={18} aria-hidden="true" />
                  )}
                </button>
              </>
            }
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Categoría
                </dt>
                <dd className="truncate font-bold text-slate-600">
                  {med.category || "—"}
                  {med.subcategory ? ` · ${med.subcategory}` : ""}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Tipo
                </dt>
                <dd className="font-bold text-slate-600">
                  {med.productType ? (
                    <span
                      className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${productTypeChipClass(med.productType)}`}
                    >
                      {med.productType}
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Descuento
                </dt>
                <dd className="font-bold text-slate-600">
                  {med.discount ? `${med.discount}%` : "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Stock mínimo
                </dt>
                <dd className="font-bold text-slate-600">{med.minimum}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Desglose
                </dt>
                <dd className="font-bold text-slate-600">
                  Base {formatPrice(breakdown.saleNoVat)} · IVA {formatPrice(breakdown.iva)}
                </dd>
              </div>
              {med.description ? (
                <div className="col-span-2 min-w-0">
                  <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Descripción
                  </dt>
                  <dd className="font-bold text-slate-500">{med.description}</dd>
                </div>
              ) : null}
            </dl>
          </RecordCard>
        );
      })}
    </ul>
  );
}
