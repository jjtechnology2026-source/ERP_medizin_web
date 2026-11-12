"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { HiDocumentText, HiSearch } from "react-icons/hi";
import { useCashierWorkflowStore } from "@/modules/cash-register/store/cashier-workflow.store";
import CashierSessionCard from "@/modules/cash-register/components/CashierSessionCard";
import ProductSearchBar from "@/modules/cash-register/components/ProductSearchBar";
import ActionButtons from "@/modules/cash-register/components/ActionButtons";
import OrderTabs from "@/modules/cash-register/components/OrderTabs";
import OrderItemsTable from "@/modules/cash-register/components/OrderItemsTable";
import CheckoutBar from "@/modules/cash-register/components/CheckoutBar";
import RecentInvoicesCard from "@/modules/cash-register/components/RecentInvoicesCard";
import CustomerDataDialog from "@/modules/cash-register/components/CustomerDataDialog";
import PaymentDialog from "@/modules/cash-register/components/PaymentDialog";
import PendingQuotesDialog from "@/modules/cash-register/components/PendingQuotesDialog";
import GroupAvailabilityDialog from "@/modules/cash-register/components/GroupAvailabilityDialog";

export default function CashRegisterFeature() {
  const { load, ensureSession, activeSession, isLoading } = useCashierWorkflowStore();
  const { data: session } = useSession();

  // pharmacyId directamente de la sesión de NextAuth (valor confirmado en logs)
  const pharmacyId = (session?.user as any)?.pharmacyId;

  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPendingQuotes, setShowPendingQuotes] = useState(false);
  const [showPendingDeliveryNotes, setShowPendingDeliveryNotes] = useState(false);
  const [showGroupAvailability, setShowGroupAvailability] = useState(false);

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
        showGroupAvailability
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
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-[#f8fafc] min-h-full">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-black text-[#0057FF] tracking-tight">
          Caja de ventas
        </h1>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setShowGroupAvailability(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-black text-xs shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <HiSearch size={16} />
            Consultar en mi grupo
          </button>
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
              <ProductSearchBar />
              <ActionButtons onCheckout={() => setShowCustomerDialog(true)} />
              <OrderTabs />
              <OrderItemsTable />
            </div>
            <CheckoutBar onCheckout={() => setShowCustomerDialog(true)} />
          </div>

          <RecentInvoicesCard />
        </div>
      )}

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