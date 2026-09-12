"use client";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Carga progresiva: dispara `onLoadMore` cuando el sentinel entra (o esta por
 * entrar) al viewport. El sentinel debe existir siempre (no dentro de un
 * condicional), porque el observer se engancha al montar.
 *
 * `onLoadMore` vive en un ref: si cambiara de identidad en cada render, el
 * observer se reengancharia y dispararia peticiones duplicadas con el mismo cursor.
 */
export function useInfiniteScroll(
  ref: RefObject<HTMLElement | null>,
  opts: { hasMore: boolean; isLoading: boolean; onLoadMore: () => void },
) {
  const { hasMore, isLoading, onLoadMore } = opts;
  const cbRef = useRef(onLoadMore);
  useEffect(() => {
    cbRef.current = onLoadMore;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          cbRef.current();
        }
      },
      { rootMargin: "800px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, hasMore, isLoading]);
}
