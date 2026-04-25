"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import Settings from "@/modules/settings";

export default function SettingsPage() {
  usePageTitle("Configuraciones");
  return (
    <DashboardLayout>
      <Settings />
    </DashboardLayout>
  );
}
