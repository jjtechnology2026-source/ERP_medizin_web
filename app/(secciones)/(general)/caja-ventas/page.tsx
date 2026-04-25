"use client";
import DashboardLayout from "@/components/ui/layout";
import CajaVentasFeature from "@/modules/general/cajaVentas";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";

export default function CajaVentasPage() {
  usePageTitle("Caja de Ventas");
  return (
    <DashboardLayout>
      <CajaVentasFeature />
    </DashboardLayout>
  );
}
