"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import Statistics from "@/modules/stadistics";

export default function EstadisticasPage() {
  usePageTitle("Estadísticas");
  return (
    <DashboardLayout>
      <Statistics />
    </DashboardLayout>
  );
}
