"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HiOutlineCamera,
  HiOutlineDeviceMobile,
  HiOutlineExclamationCircle,
  HiOutlineQrcode,
  HiOutlineRefresh,
  HiOutlineStop,
} from "react-icons/hi";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useIsMobileViewport } from "@/modules/core/hooks/useIsMobileViewport";
import { productsService } from "@/modules/products/api/products.service";
import type { Medication } from "@/modules/products/types/products.types";
import ScanResultCard from "./components/ScanResultCard";
import StockAdjustControl from "./components/StockAdjustControl";
import { useBarcodeScanner, type ScannerStatus } from "./hooks/useBarcodeScanner";
import { useStockAdjustPermit } from "./hooks/useStockAdjustPermit";
import { lookupScannedCode, type ScanLookup } from "./lib/barcode-lookup.ts";
import type { StockAdjustResult } from "./lib/stock-adjust-contract.ts";

/** Estados sin salida por sí solos: título y explicación accionable (S6). */
const CAMERA_PROBLEM_COPY: Record<
  Exclude<ScannerStatus, "idle" | "starting" | "running">,
  { title: string; hint: string; canRetry: boolean }
> = {
  denied: {
    title: "Permiso de cámara denegado",
    hint: "Habilitalo para este sitio en los ajustes del navegador y volvé a intentar.",
    canRetry: true,
  },
  "no-camera": {
    title: "Sin cámara",
    hint: "Este dispositivo no tiene una cámara disponible para escanear.",
    canRetry: false,
  },
  insecure: {
    title: "Conexión no segura",
    hint: "La cámara sólo funciona con HTTPS. Abrí la app con https:// desde el celular.",
    canRetry: false,
  },
  unsupported: {
    title: "Navegador no soportado",
    hint: "Probá con Safari o Chrome actualizados; este navegador no puede leer los códigos.",
    canRetry: false,
  },
  error: {
    title: "No se pudo usar la cámara",
    hint: "Cerrá otras apps que la estén usando y volvé a intentar.",
    canRetry: true,
  },
};

/**
 * Pantalla `/escaner`: escanear un código de barras con la cámara del celular,
 * consultar precio y stock (S1/S2 de `odd/tasks/barcode-scan-price.md`) y, con el
 * permiso propio, ajustar el stock del producto leído.
 *
 * En desktop no se monta nada de la cámara (S8): ni `<video>`, ni
 * `getUserMedia`, ni permiso. La decisión es por viewport (`matchMedia`), no por
 * user-agent.
 *
 * Ajuste de stock (`odd/tasks/scanner-stock-adjust.md`, T3/T4): la tarjeta suma
 * un control de cantidad que sólo se monta si la sesión tiene el permiso
 * `Ajustar stock desde escáner`. Sin el permiso la pantalla sigue leyendo precio
 * y stock exactamente como antes y no se llama a ningún endpoint de escritura.
 */
export default function ScannerFeature() {
  const isMobile = useIsMobileViewport();
  const pharmacyId = useAuthStore((state) => state.profile?.pharmacyId as string | undefined);
  // T4/S6: capacidad de la sesión, no un ítem de menú.
  const canAdjustStock = useStockAdjustPermit();

  const [lastCode, setLastCode] = useState<string | null>(null);
  const [lookup, setLookup] = useState<ScanLookup<Medication> | null>(null);
  // Resultado del último ajuste: la tarjeta muestra ese stock sin recargar y el
  // tope se calcula contra él. Se descarta al escanear el siguiente código.
  const [adjustment, setAdjustment] = useState<StockAdjustResult | null>(null);
  // Descarta respuestas viejas: un escaneo posterior debe ganar siempre.
  const lookupSeqRef = useRef(0);

  const handleDetect = useCallback(
    (code: string) => {
      const seq = ++lookupSeqRef.current;
      setLastCode(code);
      setLookup(null);
      setAdjustment(null);
      void lookupScannedCode<Medication>({
        code,
        pharmacyId,
        queryInventory: async (query) => {
          // Una sola sucursal por sesión (S4): no existe selector de farmacia.
          const result = await productsService.getCursorInventory(String(pharmacyId), {
            query,
            limit: 10,
          });
          return result.medications;
        },
      }).then((next) => {
        if (seq === lookupSeqRef.current) setLookup(next);
      });
    },
    [pharmacyId],
  );

  const { status, error, videoRef, start, stop } = useBarcodeScanner({ onDetect: handleDetect });

  // S8: si el viewport cruza a desktop con la cámara encendida (iPad en
  // landscape, o un resize), el `<video>` de abajo se desmonta pero el hook sigue
  // vivo: la cámara quedaría prendida y el bucle de decodificación agendándose.
  // Apagamos explícitamente en vez de confiar en el unmount del componente.
  useEffect(() => {
    if (!isMobile) stop();
  }, [isMobile, stop]);

  if (!isMobile) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-8 max-w-md mx-auto text-center space-y-3">
          <HiOutlineDeviceMobile size={40} className="mx-auto text-slate-300" />
          <h1 className="text-xl font-black text-slate-800">Función solo para celular</h1>
          <p className="text-xs font-bold text-slate-400 leading-relaxed">
            Para escanear códigos de barras hace falta la cámara del celular. Abrí esta pantalla
            desde el teléfono del mostrador.
          </p>
        </div>
      </div>
    );
  }

  const problem = status === "idle" || status === "starting" || status === "running"
    ? null
    : CAMERA_PROBLEM_COPY[status];

  /** Stock vigente del producto escaneado: el leído o el que dejó el ajuste. */
  const stockFor = (product: Medication) => {
    const known = Number.isFinite(product.stock) ? product.stock : 0;
    if (adjustment && adjustment.barCode === product.barCode) return adjustment.stockNuevo;
    return known;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-800">Escanear producto</h1>
          <p className="text-[11px] font-bold text-slate-400">Precio y stock, sin escribir el código</p>
        </div>
        <HiOutlineQrcode size={26} className="text-slate-300" />
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-4 space-y-3">
        {/* El <video> queda montado siempre en mobile para que el ref exista antes de
            pedir la cámara, y se mantiene visible desde `starting` para que el
            navegador no aplace la decodificación de frames. */}
        <div className={status === "running" || status === "starting" ? "relative overflow-hidden rounded-2xl bg-slate-900 aspect-[4/3]" : "hidden"}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-px bg-white/70" />
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-20 border-2 border-white/80 rounded-xl" />
        </div>

        {status === "running" && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 text-center">
              Apuntá al código de barras. Podés escanear el siguiente sin recargar.
            </p>
            <button
              onClick={stop}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
            >
              <HiOutlineStop size={18} /> Apagar cámara
            </button>
          </div>
        )}

        {status === "idle" && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 text-center">
              La cámara se enciende sólo cuando tocás el botón.
            </p>
            <button
              onClick={start}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0057FF] hover:bg-blue-700 text-white rounded-2xl font-black text-sm tracking-wide hover:scale-[1.01] active:scale-95 transition-all"
            >
              <HiOutlineCamera size={20} /> Encender cámara
            </button>
          </div>
        )}

        {status === "starting" && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-4 border-[#0055ff] border-t-transparent" />
            <p className="text-xs font-bold text-slate-400">Encendiendo la cámara...</p>
          </div>
        )}

        {problem && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700">
              <HiOutlineExclamationCircle size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-black">{problem.title}</p>
                <p className="text-[11px] font-bold leading-relaxed">{error ?? problem.hint}</p>
              </div>
            </div>
            {problem.canRetry && (
              <button
                onClick={start}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
              >
                <HiOutlineRefresh size={18} /> Reintentar
              </button>
            )}
          </div>
        )}
      </div>

      {lastCode && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Último escaneo
          </p>
          {!lookup ? (
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 px-5 py-6 text-center">
              <p className="text-xs font-bold text-slate-400">Buscando el producto...</p>
            </div>
          ) : lookup.status === "found" ? (
            <div className="space-y-3">
              <ScanResultCard product={lookup.product} stock={stockFor(lookup.product)} />
              {/* Sin el permiso no se monta nada de esto: ni campo, ni botones,
                  ni llamada al endpoint (T4). El `key` reinicia la cantidad con
                  cada producto escaneado. */}
              {canAdjustStock && lookup.product.barCode && (
                <StockAdjustControl
                  key={lookup.product.barCode}
                  barCode={lookup.product.barCode}
                  pharmacyId={pharmacyId}
                  stock={stockFor(lookup.product)}
                  onAdjusted={setAdjustment}
                />
              )}
            </div>
          ) : lookup.status === "not-found" ? (
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-5 space-y-2 text-center">
              <p className="text-sm font-black text-amber-600">Código no encontrado</p>
              <p className="text-[11px] font-bold text-slate-400">
                Ningún producto de esta farmacia tiene el código
              </p>
              <p className="text-sm font-mono font-black text-slate-700">{lookup.code}</p>
            </div>
          ) : lookup.status === "no-pharmacy" ? (
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-5 text-center">
              <p className="text-sm font-black text-amber-600">Sin farmacia asignada</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400 leading-relaxed">
                Tu usuario no tiene una sucursal asignada, así que no hay inventario que consultar.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-5 text-center">
              <p className="text-sm font-black text-red-500">No se pudo consultar el precio</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400 leading-relaxed">
                {lookup.message}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
