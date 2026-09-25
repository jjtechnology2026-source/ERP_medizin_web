"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import CashRegisterFeature from "@/modules/cash-register";

export default function CajaVentasPage() {
  usePageTitle("Caja de Ventas");
  return (
    <DashboardLayout>
      <CashRegisterFeature />
    </DashboardLayout>
  );
}
