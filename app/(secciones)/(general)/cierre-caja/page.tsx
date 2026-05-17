"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import CierreCajaFeature from "@/modules/cierre-caja";

export default function CierreCajaPage() {
  usePageTitle("Cierre de Caja");
  return (
    <DashboardLayout>
      <CierreCajaFeature />
    </DashboardLayout>
  );
}
