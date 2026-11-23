"use client";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import DashboardLayout from "@/components/ui/layout";
import ScannerFeature from "@/modules/scanner";

export default function EscanerPage() {
  usePageTitle("Escanear producto");
  return (
    <DashboardLayout>
      <ScannerFeature />
    </DashboardLayout>
  );
}
