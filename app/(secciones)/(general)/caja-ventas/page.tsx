"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import CajaVentasFeature from "@/modules/general/cajaVentas";

export default function CajaVentasPage() {
  usePageTitle("Caja de Ventas");
  return (
    <DashboardLayout>
      <CajaVentasFeature />
    </DashboardLayout>
  );
}
