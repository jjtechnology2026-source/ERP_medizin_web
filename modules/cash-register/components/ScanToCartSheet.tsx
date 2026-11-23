"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HiOutlineCamera,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineMinus,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineStop,
} from "react-icons/hi";
import Sheet from "@/components/ui/sheet";
import { cn } from "@/modules/core/utils/ui";
import { useFormatCurrency } from "@/modules/core/hooks/useFormatCurrency";
import { useIsMobileViewport } from "@/modules/core/hooks/useIsMobileViewport";
import { productsService } from "@/modules/products/api/products.service";
import type { Medication } from "@/modules/products/types/products.types";
import { useBarcodeScanner, type ScannerStatus } from "@/modules/scanner/hooks/useBarcodeScanner";
import { lookupScannedCode, type ScanLookup } from "@/modules/scanner/lib/barcode-lookup.ts";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import {
  cartQuantityAfterAdd,
  defaultScanQuantity,
  parseScanQuantity,
  remainingStock,
  scanAddIssue,
  scanAddIssueMessage,
  stepScanQuantity,
} from "@/modules/cash-register/lib/scan-to-cart";

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

interface ScanToCartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sucursal de la sesión: define el inventario contra el que se resuelve el código. */
  pharmacyId?: string;
}

interface AddedToCart {
  name: string;
  quantity: number;
  /** Unidades de ese producto que quedaron en la venta después de agregar. */
  totalInCart: number;
  /** Unidades totales de la venta, para que se vea que el carrito creció (S3). */
  saleUnits: number;
}

/**
 * "Escanear para vender" (T1 de `odd/tasks/scan-to-cart.md`).
 *
 * El decodificado no se reimplementa (S4): usa el hook de `modules/scanner`, que
 * ya trae la aceptación por simbología con verificador y la doble lectura, y
 * resuelve el producto con `lookupScannedCode`, que devuelve **match exacto**
 * contra el `barCode` guardado. Lo que se agrega al carrito es ese producto
 * resuelto (`product.barCode`), nunca el texto decodificado.
 *
 * El carrito y el cobro no se tocan (S3): el único camino de escritura es
 * `addMedication(product, quantity)` del store, con la cantidad ya acotada al
 * stock disponible (`lib/scan-to-cart`), para que el cobro no falle después.
 *
 * La cámara queda encendida al agregar: el flujo es acumulativo — escanear,
 * elegir cantidad, agregar, el siguiente (S3). Un código que no está en el
 * inventario de la sucursal se dice y no apaga nada (S6).
 */
export default function ScanToCartSheet({ open, onOpenChange, pharmacyId }: ScanToCartSheetProps) {
  const { format } = useFormatCurrency();
  const isMobile = useIsMobileViewport();

  // Suscripción a `orders` para que el sheet reaccione a lo que agrega (y a lo
  // que otro flujo agregue con el sheet abierto).
  const orders = useCurrentOrderStore((state) => state.orders);
  const currentOrderIndex = useCurrentOrderStore((state) => state.currentOrderIndex);
  const addMedication = useCurrentOrderStore((state) => state.addMedication);
  const cartUnits = orders[currentOrderIndex]?.medications ?? [];

  const [code, setCode] = useState<string | null>(null);
  const [lookup, setLookup] = useState<ScanLookup<Medication> | null>(null);
  const [quantityText, setQuantityText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [added, setAdded] = useState<AddedToCart | null>(null);
  // Un escaneo posterior siempre gana sobre la respuesta del anterior.
  const lookupSeqRef = useRef(0);

  /**
   * Unidades de ese `barCode` ya cargadas en la venta. Se lee del store en el
   * momento (no del render) porque el tope se calcula al resolver el código y
   * después de cada "Agregar".
   */
  const cartQuantityOf = useCallback((barCode: string) => {
    const order = useCurrentOrderStore.getState().getCurrentOrder();
    const meds = order?.medications ?? [];
    return meds
      .filter((med) => med.barCode === barCode)
      .reduce((sum, med) => cartQuantityAfterAdd(sum, Number(med.quantity)), 0);
  }, []);

  const handleDetect = useCallback(
    (scanned: string) => {
      const seq = ++lookupSeqRef.current;
      setCode(scanned);
      setLookup(null);
      setAddError(null);
      setAdded(null);
      setQuantityText("");
      void lookupScannedCode<Medication>({
        code: scanned,
        pharmacyId,
        queryInventory: async (query) => {
          // Una sola sucursal por sesión, igual que `/escaner`: no hay selector.
          const result = await productsService.getCursorInventory(String(pharmacyId), {
            query,
            limit: 10,
          });
          return result.medications;
        },
      }).then((next) => {
        if (seq !== lookupSeqRef.current) return;
        setLookup(next);
        if (next.status === "found") {
          const remaining = remainingStock(next.product.stock, cartQuantityOf(next.product.barCode));
          setQuantityText(String(defaultScanQuantity(remaining)));
        }
      });
    },
    [pharmacyId, cartQuantityOf],
  );

  const { status, error, videoRef, start, stop } = useBarcodeScanner({ onDetect: handleDetect });

  // S4: si el viewport cruza a escritorio con la cámara encendida (iPad en
  // landscape), no se deja el stream vivo detrás de un sheet que el teléfono no
  // muestra. El disparador vive en la `ActionBar`, que es `lg:hidden`.
  useEffect(() => {
    if (!isMobile) stop();
  }, [isMobile, stop]);

  // Cerrar el sheet apaga la cámara (Radix desmonta el contenido, no el hook) y
  // limpia el último escaneo: al volver a abrirlo no queda un producto viejo
  // esperando un "Agregar" ni un track de cámara encendido.
  useEffect(() => {
    if (open) return;
    stop();
    lookupSeqRef.current += 1;
    setCode(null);
    setLookup(null);
    setQuantityText("");
    setAddError(null);
    setAdded(null);
  }, [open, stop]);

  const product = lookup?.status === "found" ? lookup.product : null;
  const inCart = product ? cartQuantityOf(product.barCode) : 0;
  const stock = product && Number.isFinite(product.stock) ? Math.floor(product.stock) : 0;
  const remaining = product ? remainingStock(stock, inCart) : 0;
  const quantity = parseScanQuantity(quantityText, remaining);
  const issue = product ? scanAddIssue(quantity, remaining) : null;
  const issueMessage = product
    ? issue === "out-of-stock" && inCart > 0
      ? "Ya cargaste en la venta todas las unidades disponibles."
      : scanAddIssueMessage(issue, remaining)
    : null;

  /** El input es texto: se filtra a dígitos y se acota al stock, así el número
   *  que se ve es exactamente el que se agrega (S5). */
  const changeQuantityText = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    setAddError(null);
    setQuantityText(digits === "" ? "" : String(parseScanQuantity(digits, remaining)));
  };

  const stepQuantity = (delta: number) => {
    setAddError(null);
    setQuantityText(String(stepScanQuantity(quantity, delta, remaining)));
  };

  const handleAdd = () => {
    if (!product || issue) return;
    const saleUnitsBefore = cartUnits.reduce(
      (sum, med) => cartQuantityAfterAdd(sum, Number(med.quantity)),
      0,
    );
    const result = addMedication(product, quantity);
    if (!result.success) {
      setAddError(result.error ?? "No se pudo agregar el producto a la venta.");
      return;
    }
    setAdded({
      name: product.name,
      quantity,
      totalInCart: cartQuantityAfterAdd(inCart, quantity),
      saleUnits: saleUnitsBefore + quantity,
    });
    // Vuelta a foja cero para el siguiente producto: la cámara no se toca, sigue
    // en `running` (S3).
    setLookup(null);
    setCode(null);
    setQuantityText("");
    setAddError(null);
  };

  const problem =
    status === "idle" || status === "starting" || status === "running"
      ? null
      : CAMERA_PROBLEM_COPY[status];

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Escanear productos"
      description="Sumá a la venta sin buscarlos a mano"
      // Same reason as the search sheet: a content-height panel opened as a strip
      // at the foot of the screen and the camera preview had nowhere to live.
      panelClassName="max-lg:h-[92dvh] max-lg:max-h-[92dvh]"
      footer={
        product ? (
          <div className="flex flex-col gap-2">
            {issueMessage ? (
              <p className="text-[11px] font-bold leading-snug text-amber-600">{issueMessage}</p>
            ) : null}
            {addError ? (
              <p className="text-[11px] font-bold leading-snug text-red-500">{addError}</p>
            ) : null}
            <button
              type="button"
              onClick={handleAdd}
              disabled={issue !== null}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0057FF] px-4 text-sm font-black text-white transition-colors active:bg-[#0046CC] disabled:bg-slate-300 disabled:text-slate-500"
            >
              <HiOutlinePlus size={20} aria-hidden="true" />
              Agregar a la venta
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        {/* Confirmación del agregado: dice qué entró y cuánto tiene la venta (S3).
            `role="status"` lo anuncia sin robar el foco del escaneo. */}
        {added ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-700"
          >
            <HiOutlineCheckCircle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-black">
                Agregado: {added.quantity} × {added.name}
              </p>
              <p className="text-[11px] font-bold leading-relaxed">
                {added.totalInCart} {added.totalInCart === 1 ? "unidad" : "unidades"} de este
                producto en la venta · {added.saleUnits} en total. Escaneá el siguiente.
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
          {/* El `<video>` queda montado siempre: el ref tiene que existir antes de
              pedir la cámara, y el frame se ve desde `starting`. */}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl bg-slate-900 aspect-[4/3]",
              status === "running" || status === "starting" ? "" : "hidden",
            )}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-white/70" />
            <div className="absolute inset-x-6 top-1/2 h-20 -translate-y-1/2 rounded-xl border-2 border-white/80" />
          </div>

          {status === "idle" ? (
            <div className="space-y-3">
              <p className="text-center text-xs font-bold text-slate-400">
                La cámara se enciende sólo cuando tocás el botón.
              </p>
              <button
                type="button"
                onClick={start}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0057FF] text-sm font-black tracking-wide text-white transition-colors active:bg-[#0046CC]"
              >
                <HiOutlineCamera size={20} aria-hidden="true" /> Encender cámara
              </button>
            </div>
          ) : null}

          {status === "starting" ? (
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#0055FF] border-t-transparent" />
              <p className="text-xs font-bold text-slate-400">Encendiendo la cámara...</p>
            </div>
          ) : null}

          {status === "running" ? (
            <div className="space-y-3">
              <p className="text-center text-xs font-bold text-slate-400">
                Apuntá al código de barras. Después de agregar podés escanear el siguiente.
              </p>
              <button
                type="button"
                onClick={stop}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 text-sm font-black text-slate-500 transition-colors active:bg-slate-200"
              >
                <HiOutlineStop size={18} aria-hidden="true" /> Apagar cámara
              </button>
            </div>
          ) : null}

          {problem ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-amber-700">
                <HiOutlineExclamationCircle size={20} className="mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-black">{problem.title}</p>
                  <p className="text-[11px] font-bold leading-relaxed">{error ?? problem.hint}</p>
                </div>
              </div>
              {problem.canRetry ? (
                <button
                  type="button"
                  onClick={start}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 text-sm font-black text-slate-500 transition-colors active:bg-slate-200"
                >
                  <HiOutlineRefresh size={18} aria-hidden="true" /> Reintentar
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {code && !lookup ? (
          <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6 text-center">
            <p className="text-xs font-bold text-slate-400">Buscando el producto...</p>
            <p className="mt-1 font-mono text-[11px] font-bold text-slate-500">{code}</p>
          </div>
        ) : null}

        {product ? (
          <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
            <div className="min-w-0 space-y-1">
              <p className="break-words text-sm font-black text-slate-800">{product.name}</p>
              <p className="text-[11px] font-bold text-slate-400">
                {[product.activeIngredient, product.tablets].filter(Boolean).join(" • ")}
              </p>
              {/* El código guardado del producto resuelto: es lo que va al carrito. */}
              <p className="font-mono text-[10px] font-bold text-slate-400">{product.barCode}</p>
            </div>

            <div className="flex items-end justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Precio
                </p>
                <p className="text-lg font-black text-blue-600">
                  {format(Number.isFinite(product.price) ? product.price : 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Stock</p>
                <p className="text-sm font-black text-slate-600">{stock} u.</p>
                {inCart > 0 ? (
                  <p className="text-[10px] font-bold text-slate-400">En la venta: {inCart}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`scan-quantity-${product.barCode}`}
                className="block text-xs font-black text-slate-600"
              >
                Cantidad a vender
              </label>
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => stepQuantity(-1)}
                  disabled={quantity <= 1}
                  aria-label="Restar una unidad"
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors active:bg-slate-200 disabled:opacity-40"
                >
                  <HiOutlineMinus size={20} aria-hidden="true" />
                </button>
                {/* 16px de fuente: por debajo, iOS hace zoom al enfocar (S8). */}
                <input
                  id={`scan-quantity-${product.barCode}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={quantityText}
                  onChange={(event) => changeQuantityText(event.target.value)}
                  className="min-h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white text-center text-base font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => stepQuantity(1)}
                  disabled={quantity >= remaining}
                  aria-label="Sumar una unidad"
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors active:bg-slate-200 disabled:opacity-40"
                >
                  <HiOutlinePlus size={20} aria-hidden="true" />
                </button>
              </div>
              <p className="text-[11px] font-bold text-slate-400">
                {remaining > 0
                  ? `Disponible para esta venta: ${remaining} u.`
                  : "Sin unidades disponibles para esta venta."}
              </p>
            </div>
          </div>
        ) : null}

        {/* S6: un código que no está se dice y la cámara sigue encendida. */}
        {lookup?.status === "not-found" ? (
          <div className="space-y-1 rounded-2xl border border-amber-100 bg-white p-5 text-center">
            <p className="text-sm font-black text-amber-600">Código no encontrado</p>
            <p className="text-[11px] font-bold text-slate-400">
              Ningún producto de esta sucursal tiene ese código. Escaneá el siguiente.
            </p>
            <p className="font-mono text-sm font-black text-slate-700">{lookup.code}</p>
          </div>
        ) : null}

        {lookup?.status === "no-pharmacy" ? (
          <div className="rounded-2xl border border-amber-100 bg-white p-5 text-center">
            <p className="text-sm font-black text-amber-600">Sin farmacia asignada</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-400">
              Tu usuario no tiene una sucursal asignada, así que no hay inventario que consultar.
            </p>
          </div>
        ) : null}

        {lookup?.status === "error" ? (
          <div className="rounded-2xl border border-red-100 bg-white p-5 text-center">
            <p className="text-sm font-black text-red-500">No se pudo consultar el producto</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-400">
              {lookup.message}
            </p>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
