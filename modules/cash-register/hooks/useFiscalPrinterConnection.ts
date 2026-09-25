"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

const PRINTER_URL = "http://127.0.0.1:8000/health";

export type FiscalPrinterState = "idle" | "checking" | "available" | "blocked" | "unreachable";

export function useFiscalPrinterConnection() {
  const profile = useAuthStore((s) => s.profile);
  const usesFiscal = !profile?.usesDigitalBilling;

  const [state, setState] = useState<FiscalPrinterState>("idle");
  const [retrying, setRetrying] = useState(false);

  const check = async () => {
    setState("checking");
    try {
      const res = await fetch(PRINTER_URL, { method: "GET", mode: "cors" });
      if (res.ok) {
        setState("available");
      } else {
        setState("blocked");
      }
    } catch {
      setState("blocked");
    }
  };

  useEffect(() => {
    if (!usesFiscal) return;
    check();
  }, [usesFiscal]);

  const retry = () => {
    setRetrying((r) => !r);
    check();
  };

  return { state, retry };
}
