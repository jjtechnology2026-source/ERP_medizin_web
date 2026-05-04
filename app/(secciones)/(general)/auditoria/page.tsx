"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import AuditPage from "@/modules/audit";

export default function AuditoriaPage() {
  usePageTitle("Auditoría");

  return (
    <DashboardLayout>
      <AuditPage />
    </DashboardLayout>
  );
}
