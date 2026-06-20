"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import MarketplaceOrdersFeature from "@/modules/marketplace";

export default function MarketplacePage() {
  usePageTitle("Órdenes marketplace");

  return (
    <DashboardLayout>
      <MarketplaceOrdersFeature />
    </DashboardLayout>
  );
}
