"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/modules/core/hooks/usePermissions";
import { HiDocumentText, HiDotsVertical, HiOutlineCamera, HiSearch } from "react-icons/hi";
import ActionBar from "@/components/ui/action-bar";
import Sheet from "@/components/ui/sheet";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import CashierSessionCard from "@/modules/cash-register/components/CashierSessionCard";
import ProductSearchBar from "@/modules/cash-register/components/ProductSearchBar";
import ActionButtons from "@/modules/cash-register/components/ActionButtons";
import OrderTabs from "@/modules/cash-register/components/OrderTabs";
import OrderItemsTable from "@/modules/cash-register/components/OrderItemsTable";
import OrderItemsCardList from "@/modules/cash-register/components/OrderItemsCardList";
import CheckoutBar from "@/modules/cash-register/components/CheckoutBar";
import RecentInvoicesCard from "@/modules/cash-register/components/RecentInvoicesCard";
import MobileCashRegisterSheet from "@/modules/cash-register/components/MobileCashRegisterSheet";
import ScanToCartSheet from "@/modules/cash-register/components/ScanToCartSheet";
import CustomerDataDialog from "@/modules/cash-register/components/CustomerDataDialog";
import PaymentDialog from "@/modules/cash-register/components/PaymentDialog";
import PendingQuotesDialog from "@/modules/cash-register/components/PendingQuotesDialog";
import GroupAvailabilityDialog from "@/modules/cash-register/components/GroupAvailabilityDialog";

export default function CashRegisterFeature() {
  const { load, ensureSession, activeSession, isLoading } = useCashierWorkflowStore();
  const { getComputedTotals, getCurrentOrder } = useCurrentOrderStore();
  const { isDollar } = useCurrencyStore();
  const { data: session } = useSession();
  const { permits } = usePermissions();
  const canConsultarGrupo = permits.some(
    (p: string) => p.toLowerCase() === "consultar en grupo",
  );

  // pharmacyId directamente de la sesión de NextAuth (valor confirmado en logs)
  const pharmacyId = (session?.user as any)?.pharmacyId;

  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPendingQuotes, setShowPendingQuotes] = useState(false);
  const [showPendingDeliveryNotes, setShowPendingDeliveryNotes] = useState(false);
  const [showGroupAvailability, setShowGroupAvailability] = useState(false);
  const [showSearchSheet, setShowSearchSheet] = useState(false);
  const [showScanSheet, setShowScanSheet] = useState(false);
  const [showActionsSheet, setShowActionsSheet] = useState(false);

  // Panel of the fixed ActionBar: the phone's only primary action is `Cobrar`
  // and it carries the amount, so the total never needs a second tap (S6).
  const totals = getComputedTotals();
  const order = getCurrentOrder();
  const hasItems = (order?.medications.length ?? 0) > 0;
  const cartTotalLabel = isDollar
    ? `$ ${totals.total.toFixed(2)}`
    : `Bs ${totals.totalBs.toFixed(2)}`;

  useEffect(() => {
    if (!pharmacyId) return;
    // Carga la sesión de la caja del terminal y, si no hay ninguna, la abre sola
    // cuando la caja es inequívoca. El cajero entra y ya puede vender.
    (async () => {
      await load(pharmacyId);
      await ensureSession();
    })();
  }, [pharmacyId, load, ensureSession]);

  // Enter → "siguiente" (checkout): pasa del carrito al diálogo de cliente.
  // No dispara mientras se escribe en inputs/selects ni con un diálogo abierto.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? "";
      if (["input", "textarea", "select"].includes(tag) || target?.isContentEditable) return;
      if (
        showCustomerDialog ||
        showPaymentDialog ||
        showPendingQuotes ||
        showPendingDeliveryNotes ||
        showGroupAvailability ||
        showScanSheet
      )
        return;
      setShowCustomerDialog(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    showCustomerDialog,
    showPaymentDialog,
    showPendingQuotes,
    showPendingDeliveryNotes,
    showGroupAvailability,
    showScanSheet,
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-[#f8fafc] min-h-full">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-black text-[#0057FF] tracking-tight">
          Caja de ventas
        </h1>
        {/* Desktop header actions, unchanged (S4). On a phone they live in the
            overflow sheet so the surface keeps three controls (S6). */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={() => setShowPendingQuotes(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-[#0055ff] border border-blue-100 rounded-xl font-black text-xs shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <HiDocumentText size={16} />
            Cotizaciones
          </button>
          <button
            onClick={() => setShowPendingDeliveryNotes(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-amber-700 border border-amber-100 rounded-xl font-black text-xs shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <HiDocumentText size={16} />
            Notas de entrega
          </button>
          {canConsultarGrupo && (
            <button
              onClick={() => setShowGroupAvailability(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-black text-xs shadow-sm hover:scale-105 active:scale-95 transition-all"
            >
              <HiSearch size={16} />
              Consultar en mi grupo
            </button>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0057FF] border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto">
          <CashierSessionCard />

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 space-y-5">
              {/* Desktop barcode/name search keeps its place (S4); on a phone it
                  opens from the `Buscar` shortcut of the ActionBar. */}
              <div className="hidden lg:block">
                <ProductSearchBar />
              </div>
              <ActionButtons onCheckout={() => setShowCustomerDialog(true)} />
              <OrderTabs />
              <div className="hidden lg:block">
                <OrderItemsTable />
              </div>
              <OrderItemsCardList />
            </div>
            <CheckoutBar onCheckout={() => setShowCustomerDialog(true)} />
          </div>

          <RecentInvoicesCard />

          {/* The fixed ActionBar must not cover the last card (S6). */}
          <div aria-hidden="true" className="h-[var(--action-bar-block-size)] lg:hidden" />
        </div>
      )}

      {/* One primary action (`Cobrar`) plus the shortcuts: search by hand, scan
          to add, and the overflow (S6). Everything here is `lg:hidden` inside
          `ActionBar`, so desktop is untouched (S4). */}
      {!isLoading && (
        <ActionBar
          stacked
          primary={
            <button
              type="button"
              onClick={() => setShowCustomerDialog(true)}
              disabled={!hasItems}
              className="flex flex-col items-center justify-center rounded-2xl bg-[#0057FF] px-4 text-white transition-colors active:bg-[#0046CC] disabled:bg-slate-300 disabled:text-slate-500"
            >
              <span className="text-sm font-black leading-tight">Cobrar</span>
              <span className="text-[11px] font-bold leading-tight">
                {hasItems ? cartTotalLabel : "Carrito vacío"}
              </span>
            </button>
          }
          secondary={[
            // Search and scan share one slot on purpose: `ActionBar` renders at
            // most two secondary actions and `components/**` is not part of this
            // slice, so passing them separately would silently drop the overflow
            // (`Más`) and take quotes, delivery notes and the shift away. Both
            // halves stay 44×44.
            <div key="search-scan" className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSearchSheet(true)}
                aria-label="Buscar producto"
                title="Buscar producto"
                className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors active:bg-slate-200"
              >
                <HiSearch size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setShowScanSheet(true)}
                aria-label="Escanear producto"
                title="Escanear producto"
                className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors active:bg-slate-200"
              >
                <HiOutlineCamera size={22} aria-hidden="true" />
              </button>
            </div>,
            <button
              key="more"
              type="button"
              onClick={() => setShowActionsSheet(true)}
              aria-label="Más acciones"
              title="Más acciones"
              className="flex items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors active:bg-slate-200"
            >
              <HiDotsVertical size={22} aria-hidden="true" />
            </button>,
          ]}
        />
      )}

      <ScanToCartSheet
        open={showScanSheet}
        onOpenChange={setShowScanSheet}
        pharmacyId={pharmacyId}
      />

      <Sheet
        open={showSearchSheet}
        onOpenChange={setShowSearchSheet}
        title="Buscar producto"
        description="Escanea el código o busca por nombre"
        // A search surface needs room: as a content-height sheet it opened as a
        // strip at the foot of the screen and showed one product at a time.
        panelClassName="max-lg:h-[92dvh] max-lg:max-h-[92dvh]"
      >
        <ProductSearchBar />
      </Sheet>

      <MobileCashRegisterSheet
        open={showActionsSheet}
        onOpenChange={setShowActionsSheet}
        onOpenQuotes={() => setShowPendingQuotes(true)}
        onOpenDeliveryNotes={() => setShowPendingDeliveryNotes(true)}
        onOpenGroupAvailability={
          canConsultarGrupo ? () => setShowGroupAvailability(true) : undefined
        }
      />

      {showCustomerDialog && (
        <CustomerDataDialog
          onClose={() => setShowCustomerDialog(false)}
          onContinue={() => {
            setShowCustomerDialog(false);
            setShowPaymentDialog(true);
          }}
        />
      )}

      {showPaymentDialog && (
        <PaymentDialog
          onClose={() => setShowPaymentDialog(false)}
          onComplete={() => setShowPaymentDialog(false)}
        />
      )}

      {showPendingQuotes && (
        <PendingQuotesDialog onClose={() => setShowPendingQuotes(false)} />
      )}

      {showPendingDeliveryNotes && (
        <PendingQuotesDialog
          onClose={() => setShowPendingDeliveryNotes(false)}
          mode="delivery-note"
        />
      )}

      {showGroupAvailability && (
        <GroupAvailabilityDialog onClose={() => setShowGroupAvailability(false)} />
      )}
    </div>
  );
}