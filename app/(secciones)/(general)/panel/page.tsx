"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import PanelFeature from "@/modules/panel";

export default function PanelPage() {
  usePageTitle("Panel de Control");
  return (
    <DashboardLayout>
      <PanelFeature />
    </DashboardLayout>
  );
}
