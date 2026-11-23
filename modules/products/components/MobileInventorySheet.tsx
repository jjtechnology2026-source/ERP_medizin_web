"use client";
import {
  HiOutlineChevronDown,
  HiOutlineCloudUpload,
  HiOutlineCash,
  HiOutlinePlus,
  HiOutlineExclamationCircle,
} from "react-icons/hi";
import Sheet from "@/components/ui/sheet";
import { cn } from "@/modules/core/utils/ui";
import type { StockFilter } from "@/modules/products/types/products.types";

type ExistenciaFilter = "in" | "out" | null;

interface MobileInventorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockTab: StockFilter;
  onStockTabChange: (tab: StockFilter) => void;
  lowStockCount: number;
  stockFilter: ExistenciaFilter;
  onStockFilterChange: (filter: ExistenciaFilter) => void;
  onAddStock: () => void;
  onCreateProduct: () => void;
  onStockTax: () => void;
  onDownloadReport: () => void;
  isDownloadingReport: boolean;
}

interface SheetActionProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}

/** One 48px-tall row of the overflow sheet (spec S3). */
function SheetAction({ icon, label, hint, onClick, disabled }: SheetActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 active:bg-slate-100 disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">{label}</span>
        {hint ? (
          <span className="block truncate text-[11px] font-bold text-slate-400">{hint}</span>
        ) : null}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

/** A 44px-tall segment of a filter group, announced as pressed (WCAG 4.1.2). */
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-black uppercase transition-colors",
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-500 active:bg-slate-200",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The single overflow of the inventory screen on a phone (spec S6).
 *
 * The ten controls the screen used to show at once — three header actions, two
 * stock tabs, the search field and three existence chips — collapse into one
 * search field on the surface, one primary action, and this sheet. Everything
 * here is a 44px row, so no action depends on hover (spec S5).
 */
export default function MobileInventorySheet({
  open,
  onOpenChange,
  stockTab,
  onStockTabChange,
  lowStockCount,
  stockFilter,
  onStockFilterChange,
  onAddStock,
  onCreateProduct,
  onStockTax,
  onDownloadReport,
  isDownloadingReport,
}: MobileInventorySheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros y acciones"
      description="Qué productos ves y qué más podés hacer"
    >
      <div className="flex flex-col gap-1">
        <SectionLabel>Existencias</SectionLabel>
        <div className="flex gap-2">
          <FilterChip active={stockTab === "GENERAL"} onClick={() => onStockTabChange("GENERAL")}>
            Stock general
          </FilterChip>
          <FilterChip active={stockTab === "LOW"} onClick={() => onStockTabChange("LOW")}>
            <HiOutlineExclamationCircle size={14} aria-hidden="true" />
            Stock bajo
            {lowStockCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                {lowStockCount}
              </span>
            )}
          </FilterChip>
        </div>

        <div className="mt-1 flex gap-2">
          <FilterChip active={(stockFilter ?? null) === null} onClick={() => onStockFilterChange(null)}>
            Todos
          </FilterChip>
          <FilterChip active={stockFilter === "in"} onClick={() => onStockFilterChange("in")}>
            Con stock
          </FilterChip>
          <FilterChip active={stockFilter === "out"} onClick={() => onStockFilterChange("out")}>
            Sin stock
          </FilterChip>
        </div>

        <div className="mt-2 border-t border-slate-100 pt-2">
          <SectionLabel>Acciones</SectionLabel>
        </div>
        <SheetAction
          icon={<HiOutlineCloudUpload size={18} aria-hidden="true" />}
          label="Agregar a stock"
          hint="Buscar en el catálogo"
          onClick={() => {
            onOpenChange(false);
            onAddStock();
          }}
        />
        <SheetAction
          icon={<HiOutlinePlus size={18} aria-hidden="true" />}
          label="Crear producto"
          hint="Alta manual de un producto nuevo"
          onClick={() => {
            onOpenChange(false);
            onCreateProduct();
          }}
        />
        <SheetAction
          icon={<HiOutlineCash size={18} aria-hidden="true" />}
          label="Stock por impuesto"
          hint="Resumen de base e IVA"
          onClick={() => {
            onOpenChange(false);
            onStockTax();
          }}
        />
        <SheetAction
          icon={<HiOutlineChevronDown size={18} aria-hidden="true" />}
          label={isDownloadingReport ? "Generando reporte..." : "Descargar reporte"}
          hint="PDF con todo el inventario filtrado"
          disabled={isDownloadingReport}
          onClick={onDownloadReport}
        />
      </div>
    </Sheet>
  );
}
