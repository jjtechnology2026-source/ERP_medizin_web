"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineChevronDown,
  HiOutlineDocumentText,
  HiOutlinePrinter,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineShoppingBag,
  HiOutlineTrash,
  HiOutlineTruck,
} from "react-icons/hi";
import Sheet from "@/components/ui/sheet";
import SessionMetrics from "@/modules/cash-register/components/SessionMetrics";
import ManualAddDialog from "@/modules/cash-register/components/ManualAddDialog";
import PriceCheckDialog from "@/modules/cash-register/components/PriceCheckDialog";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { cn } from "@/modules/core/utils/ui";

interface MobileCashRegisterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenQuotes: () => void;
  onOpenDeliveryNotes: () => void;
  /** Only passed when the user holds `consultar en grupo`. */
  onOpenGroupAvailability?: () => void;
}

interface SheetActionProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}

/** One 48px-tall row of the overflow sheet: every action of the screen that is
 *  not the primary `Cobrar` or the `Buscar` shortcut (spec S6). */
function SheetAction({ icon, label, hint, onClick, disabled, tone = "default" }: SheetActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 active:bg-slate-100",
        tone === "danger" ? "text-red-600" : "text-slate-700",
        disabled && "opacity-40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          tone === "danger" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500",
        )}
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

/**
 * The single overflow of the cash-register screen on a phone (spec S6).
 *
 * Everything that is not `Cobrar` or `Buscar` lands here: adding several
 * products, the price check, emptying the sale, the pending quotes and delivery
 * notes, the group query, and the cash-session controls the desktop card shows
 * as buttons (refresh, go to closing, the nine metrics).
 */
export default function MobileCashRegisterSheet({
  open,
  onOpenChange,
  onOpenQuotes,
  onOpenDeliveryNotes,
  onOpenGroupAvailability,
}: MobileCashRegisterSheetProps) {
  const router = useRouter();
  const { getCurrentOrder, deleteAllOrders } = useCurrentOrderStore();
  const load = useCashierWorkflowStore((s) => s.load);
  const profile = useAuthStore((s) => s.profile);

  const [showManual, setShowManual] = useState(false);
  const [showPriceCheck, setShowPriceCheck] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showSessionDetail, setShowSessionDetail] = useState(false);

  const order = getCurrentOrder();
  const hasItems = (order?.medications.length ?? 0) > 0;

  // Cards below `sm` overlap the sheet, so the sheet closes before handing the
  // screen to the hand-written overlay dialogs (spec S9, migration per slice).
  const runAfterClose = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title="Acciones de la venta"
        description="Cobro, documentos y turno del cajero"
      >
        <div className="flex flex-col gap-1">
          <SectionLabel>Orden actual</SectionLabel>
          <SheetAction
            icon={<HiOutlineShoppingBag size={18} aria-hidden="true" />}
            label="Agregar varios"
            hint="Código de barra y cantidad"
            onClick={() => runAfterClose(() => setShowManual(true))}
          />
          <SheetAction
            icon={<HiOutlineSearch size={18} aria-hidden="true" />}
            label="Consultar precio"
            hint="Sin agregar al carrito"
            onClick={() => runAfterClose(() => setShowPriceCheck(true))}
          />
          <SheetAction
            icon={<HiOutlineTrash size={18} aria-hidden="true" />}
            label={confirmClear ? "Toca de nuevo para vaciar" : "Vaciar la venta actual"}
            hint={confirmClear ? "Se pierden todos los productos cargados" : undefined}
            tone="danger"
            disabled={!hasItems}
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true);
                return;
              }
              deleteAllOrders();
              setConfirmClear(false);
              onOpenChange(false);
            }}
          />

          <SectionLabel>Documentos</SectionLabel>
          <SheetAction
            icon={<HiOutlineDocumentText size={18} aria-hidden="true" />}
            label="Cotizaciones"
            hint="Presupuestos pendientes"
            onClick={() => runAfterClose(onOpenQuotes)}
          />
          <SheetAction
            icon={<HiOutlineTruck size={18} aria-hidden="true" />}
            label="Notas de entrega"
            onClick={() => runAfterClose(onOpenDeliveryNotes)}
          />
          {onOpenGroupAvailability ? (
            <SheetAction
              icon={<HiOutlineSearch size={18} aria-hidden="true" />}
              label="Consultar en mi grupo"
              onClick={() => runAfterClose(onOpenGroupAvailability)}
            />
          ) : null}

          <SectionLabel>Turno del cajero</SectionLabel>
          <SheetAction
            icon={<HiOutlineRefresh size={18} aria-hidden="true" />}
            label="Actualizar turno"
            hint="Vuelve a leer la caja del terminal"
            onClick={async () => {
              const pharmacyId = profile?.pharmacyId ?? profile?.id_group;
              if (pharmacyId) await load(pharmacyId);
              onOpenChange(false);
            }}
          />
          <SheetAction
            icon={<HiOutlinePrinter size={18} aria-hidden="true" />}
            label="Ir a cierre"
            onClick={() => runAfterClose(() => router.push("/cierre-caja"))}
          />

          <button
            type="button"
            onClick={() => setShowSessionDetail((prev) => !prev)}
            aria-expanded={showSessionDetail}
            className="mt-1 flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-black uppercase tracking-wide text-slate-500 transition-colors active:bg-slate-50"
          >
            {showSessionDetail ? "Ocultar detalle del turno" : "Ver detalle del turno"}
            <HiOutlineChevronDown
              size={16}
              aria-hidden="true"
              className={cn("transition-transform", showSessionDetail && "rotate-180")}
            />
          </button>
          {showSessionDetail ? <SessionMetrics className="grid-cols-2" /> : null}
        </div>
      </Sheet>

      {showManual && <ManualAddDialog onClose={() => setShowManual(false)} />}
      {showPriceCheck && <PriceCheckDialog onClose={() => setShowPriceCheck(false)} />}
    </>
  );
}
