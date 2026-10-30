"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { HiDocumentText } from "react-icons/hi";
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

export default function CashRegisterFeature() {
  const { load, activeSession, isLoading } = useCashierWorkflowStore();
  const { data: session } = useSession();

  // pharmacyId directamente de la sesión de NextAuth (valor confirmado en logs)
  const pharmacyId = (session?.user as any)?.pharmacyId;

  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPendingQuotes, setShowPendingQuotes] = useState(false);

  useEffect(() => {
    if (pharmacyId) {
      load(pharmacyId);
    }
  }, [pharmacyId, load]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-[#f8fafc] min-h-full">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-black text-[#0055ff] tracking-tight">
          Caja de ventas
        </h1>
        <button
          onClick={() => setShowPendingQuotes(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-[#0055ff] border border-blue-100 rounded-xl font-black text-xs shadow-sm hover:scale-105 active:scale-95 transition-all"
        >
          <HiDocumentText size={16} />
          Cotizaciones
        </button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0055ff] border-t-transparent" />
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
    </div>
  );
}