"use client";

import { useFormatCurrency } from "@/modules/core/hooks/useFormatCurrency";
import { effectiveVat, taxBreakdown } from "@/modules/products/lib/pricing";
import type { Medication } from "@/modules/products/types/products.types";

/**
 * Tarjeta de resultado del escaneo (T5 de `odd/tasks/barcode-scan-price.md`).
 *
 * Es un espejo deliberado del render de
 * `modules/cash-register/components/PriceCheckDialog.tsx:19`: nombre, precio
 * final CON IVA, desglose (precio base sin IVA + IVA) y stock. No se reusa ese
 * componente porque es un diálogo modal de la caja (estado propio, cierre por
 * overlay, botón "Cerrar") y esta pantalla es de sólo lectura, siempre visible,
 * con el escaneo corriendo detrás. Si el formato de precio cambia allá, hay que
 * replicarlo acá.
 *
 * Helpers compartidos en vez de matemática propia: `useFormatCurrency` (Bs/USD
 * con la tasa vigente), `taxBreakdown`/`effectiveVat` de `products/lib/pricing`,
 * y la misma regla de stock bajo que el inventario
 * (`modules/products/components/TabInventory.tsx`: `stock <= minimum`).
 */
export default function ScanResultCard({ product }: { product: Medication }) {
  const { format } = useFormatCurrency();

  const price = Number.isFinite(product.price) ? product.price : 0;
  const vat = effectiveVat(product.vat);
  const breakdown = taxBreakdown(price, vat, product.basePrice);
  const discount = typeof product.discount === "number" && product.discount > 0 ? product.discount : null;
  const stock = Number.isFinite(product.stock) ? product.stock : 0;
  const minimum = Number.isFinite(product.minimum) ? product.minimum : 0;
  const lowStock = stock <= minimum;
  const originalPrice = discount ? price / (1 - discount / 100) : null;

  return (
    <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-5 space-y-2 text-slate-800">
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-700">{product.name}</p>
        {product.activeIngredient && (
          <p className="text-xs font-semibold text-slate-400">{product.activeIngredient}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {product.barCode && (
            <span className="text-[10px] font-mono font-bold text-slate-400">{product.barCode}</span>
          )}
          {product.tablets && (
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {product.tablets}
            </span>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
        {discount && originalPrice !== null ? (
          <>
            <div className="flex justify-between">
              <span className="text-xs font-bold text-slate-400">Precio original:</span>
              <span className="text-sm font-bold text-slate-400 line-through">
                {format(originalPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-bold text-slate-400">Descuento:</span>
              <span className="text-sm font-bold text-amber-600">{discount}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-bold text-slate-400">Precio final:</span>
              <span className="text-lg font-black text-emerald-600">{format(price)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-400">Precio:</span>
            <span className="text-lg font-black text-blue-600">{format(price)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-xs font-bold text-slate-400">Precio base (sin IVA):</span>
          <span className="text-sm font-bold text-slate-600">{format(breakdown.saleNoVat)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs font-bold text-slate-400">IVA {vat}%:</span>
          <span className="text-sm font-bold text-slate-600">{format(breakdown.iva)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400">Stock:</span>
          <span className={`font-bold ${lowStock ? "text-red-500" : "text-slate-600"}`}>
            {stock} u.
            {lowStock && <span className="ml-1 text-[10px] font-black uppercase">stock bajo</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
