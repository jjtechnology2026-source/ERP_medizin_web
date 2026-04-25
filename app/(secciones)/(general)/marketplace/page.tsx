"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import MarketplaceFeature from "@/modules/stadistics";

export default function MarketplacePage() {
  usePageTitle("Cierre de Caja");
  return (
    <DashboardLayout>
      <MarketplaceFeature />
    </DashboardLayout>
  );
}
