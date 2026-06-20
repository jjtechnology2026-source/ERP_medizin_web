"use client";
import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";

export function useSidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();

  const toggleSidebar = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const isActive = useCallback(
    (href: string) => {
      if (href === "#") return false;
      return pathname === href || pathname.startsWith(href + "/");
    },
    [pathname],
  );

  return {
    isExpanded,
    toggleSidebar,
    isActive,
    pathname,
  };
}
