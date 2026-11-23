"use client";
import DashboardLayout from "@/components/ui/layout";
import MobileMoreHub from "@/components/ui/mobile-nav/MobileMoreHub";

// No `usePageTitle` here: the shell derives the section name (and the document
// title) from the same menu, which maps `/mas` to "Más".
export default function MasPage() {
  return (
    <DashboardLayout>
      <MobileMoreHub />
    </DashboardLayout>
  );
}
