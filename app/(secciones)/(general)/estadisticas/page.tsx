"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import Statistics from "@/modules/statistics";

export default function EstadisticasPage() {
  usePageTitle("Estadísticas");
  return (
    <DashboardLayout>
      <Statistics />
    </DashboardLayout>
  );
}
