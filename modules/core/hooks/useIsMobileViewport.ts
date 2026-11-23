"use client";

import { useEffect, useState } from "react";

/**
 * Definición operativa de "mobile" del shell: menos de 1024px, el mismo
 * breakpoint `lg` que corta el layout (`components/ui/layout/index.tsx`).
 *
 * Vive en `modules/core/hooks` y no en un módulo de feature porque el chrome de
 * la app (barra lateral y menú) lo consume: el shell nunca importa de
 * `modules/scanner`.
 */
export const MOBILE_VIEWPORT_QUERY = "(max-width: 1023px)";

/**
 * `true` cuando el viewport mide menos de 1024px (spec S8 de
 * `odd/tasks/barcode-scan-price.md`).
 *
 * Se evalúa con `matchMedia`, nunca con user-agent: el UA miente en tablets, en
 * devtools y en el "modo escritorio" de los navegadores móviles.
 *
 * El primer render (y el SSR) devuelve `false` porque no hay `window`; el valor
 * real llega en el efecto, así que la hidratación nunca se desincroniza.
 * Consecuencia: los ítems `mobileOnly` del menú no se pintan hasta el primer
 * efecto en el cliente — nunca se muestran en desktop.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const sync = () => setIsMobile(query.matches);
    sync();

    // `addEventListener` no existe en Safari < 14; `addListener` es el fallback.
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", sync);
      return () => query.removeEventListener("change", sync);
    }
    query.addListener(sync);
    return () => query.removeListener(sync);
  }, []);

  return isMobile;
}
