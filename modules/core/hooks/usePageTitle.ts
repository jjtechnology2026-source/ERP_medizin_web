"use client";
import { useEffect } from "react";
export function usePageTitle(title: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${title} | Medizin`;

    return () => {
      document.title = prevTitle;
    };
  }, [title]);
}
