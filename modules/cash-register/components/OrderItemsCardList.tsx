"use client";
import { HiMinus, HiPlus, HiTrash } from "react-icons/hi";
import RecordCard from "@/components/ui/record-card";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { taxBreakdown } from "@/modules/products/lib/pricing";
import { useCurrencyStore } from "@/modules/core/store/currency.store";

/**
 * Mobile composition of the cart (spec S7): the seven-column table of
 * `OrderItemsTable` collapses into one card per line with only the four fields
 * the cashier reads at the counter — name, quantity, unit price and subtotal.
 *
 * The table stays as it is from `lg` up (spec S4); this list only renders
 * below it. Quantity and removal controls are always visible and 44×44 (S3),
 * never behind a hover (S5).
 */
export default function OrderItemsCardList() {
  const { getCurrentOrder, updateQuantity, removeMedication } = useCurrentOrderStore();
  const { isDollar, getEffectiveRate } = useCurrencyStore();

  const order = getCurrentOrder();
  const rate = getEffectiveRate();

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${price.toFixed(2)}`;
    return `Bs ${(price * (rate || 1)).toFixed(2)}`;
  };

  if (!order || order.medications.length === 0) {
    return (
      <div className="py-10 text-center lg:hidden">
        <p className="text-sm font-bold text-slate-300">Agrega productos a la orden</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2 lg:hidden">
      {order.medications.map((med, i) => {
        const breakdown = taxBreakdown(med.price, med.vat ?? 0);

        return (
          <RecordCard
            key={med.barCode + i}
            title={med.name}
            subtitle={med.barCode}
            fields={[
              { label: "Cantidad", value: med.quantity, emphasis: "strong" },
              { label: "Precio unit.", value: formatPrice(med.price) },
              { label: "Subtotal", value: formatPrice(med.price * med.quantity), emphasis: "strong" },
            ]}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => updateQuantity(i, med.quantity - 1)}
                  disabled={med.quantity <= 1}
                  aria-label={`Restar una unidad de ${med.name}`}
                  className="flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors disabled:opacity-40 active:bg-slate-200"
                >
                  <HiMinus size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => updateQuantity(i, med.quantity + 1)}
                  disabled={med.quantity >= med.stock}
                  aria-label={`Sumar una unidad de ${med.name}`}
                  className="flex items-center justify-center rounded-xl bg-emerald-500 text-white transition-colors disabled:opacity-40 active:bg-emerald-600"
                >
                  <HiPlus size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => removeMedication(i)}
                  aria-label={`Quitar ${med.name} del carrito`}
                  className="flex items-center justify-center rounded-xl bg-red-50 text-red-600 transition-colors active:bg-red-100"
                >
                  <HiTrash size={18} aria-hidden="true" />
                </button>
              </>
            }
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Marca</dt>
                <dd className="truncate font-bold text-slate-600">{med.brand || "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Existencia</dt>
                <dd
                  className={`font-bold ${med.stock <= med.minimum ? "text-red-500" : "text-slate-600"}`}
                >
                  {med.stock}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Desglose</dt>
                <dd className="font-bold text-slate-600">
                  Base {formatPrice(breakdown.saleNoVat)} · IVA {formatPrice(breakdown.iva)}
                </dd>
              </div>
            </dl>
          </RecordCard>
        );
      })}
    </ul>
  );
}
