"use client";
import { HiOutlineCheck, HiOutlineChatAlt2 } from "react-icons/hi";
import RecordCard from "@/components/ui/record-card";
import { Order } from "../../orders/types/orders";
import { MarketplaceOrderSummary } from "../types/mqtt-orders";
import { isCompletedOrder, orderStatusLabel } from "../lib/order-status";

interface MarketplaceCardListProps {
  orders: Order[];
  queuedOrders?: MarketplaceOrderSummary[];
  loading: boolean;
  onView: (order: Order) => void;
  onAccept?: (id: string) => void;
  onChat?: (orderId: string, clientName?: string) => void;
  /** Opens a real-time (queued) order: resolves the Redis/MQTT source. */
  onOpenQueued: (order: MarketplaceOrderSummary) => void;
}

function SkeletonCard() {
  return (
    <li className="animate-pulse rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-slate-100" />
          <div className="h-3 w-20 rounded bg-slate-100" />
        </div>
        <div className="size-11 rounded-xl bg-slate-100" />
        <div className="size-11 rounded-xl bg-slate-100" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="h-8 rounded bg-slate-100" />
        <div className="h-8 rounded bg-slate-100" />
      </div>
    </li>
  );
}

/**
 * The marketplace order list on a phone (spec S7).
 *
 * The seven-column table (`px-8` cells inside an `overflow-x-auto`) does not fit
 * 390px and the mobile shell clips the overflow, so the far columns — status and
 * the row actions — simply disappeared. Below `lg` every order becomes one card
 * with the fields an operator decides on (date, sale type, state) always visible,
 * address and totals behind the disclosure, and the two row actions at 44×44
 * (specs S3, S5). The table stays untouched from `lg` up (spec S4).
 */
export default function MarketplaceCardList({
  orders,
  queuedOrders = [],
  loading,
  onView,
  onAccept,
  onChat,
  onOpenQueued,
}: MarketplaceCardListProps) {
  if (loading) {
    return (
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </ul>
    );
  }

  if (orders.length === 0 && queuedOrders.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center text-sm font-bold text-slate-400">
        No se encontraron órdenes de marketplace.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {queuedOrders.map((qOrder) => (
        <RecordCard
          key={qOrder.orderId}
          className="border-l-4 border-l-blue-500 bg-blue-50/40"
          title={qOrder.clientName || "Cliente"}
          subtitle={`#${qOrder.orderId.slice(-8)}`}
          fields={[
            {
              label: "Estado",
              value: <span className="text-blue-600">NUEVA</span>,
              emphasis: "strong",
            },
            { label: "Fecha", value: "Recién llegada" },
            { label: "Tipo de venta", value: qOrder.saleType || "Delivery" },
          ]}
          onSelect={() => onOpenQueued(qOrder)}
          actions={
            <>
              <button
                type="button"
                onClick={() => onAccept?.(qOrder.orderId)}
                aria-label={`Finalizar la orden ${qOrder.orderId.slice(-8)}`}
                title="Finalizar orden"
                className="flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition-colors active:bg-emerald-600 active:text-white"
              >
                <HiOutlineCheck size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onChat?.(qOrder.orderId, qOrder.clientName)}
                aria-label={`Abrir el chat con ${qOrder.clientName || "el cliente"}`}
                title="Chat con el cliente"
                className="flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors active:bg-amber-600 active:text-white"
              >
                <HiOutlineChatAlt2 size={18} aria-hidden="true" />
              </button>
            </>
          }
        >
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div className="col-span-2 min-w-0">
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Dirección
              </dt>
              <dd className="break-words font-bold capitalize text-slate-600">
                {qOrder.clientAddress || "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Total
              </dt>
              <dd className="truncate font-bold text-slate-600">
                {typeof qOrder.total === "number" ? `$ ${qOrder.total.toFixed(2)}` : "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Productos
              </dt>
              <dd className="truncate font-bold text-slate-600">
                {qOrder.items?.length ?? 0}
              </dd>
            </div>
          </dl>
        </RecordCard>
      ))}

      {orders.map((order) => {
        const completed = isCompletedOrder(order);

        return (
          <RecordCard
            key={order.id}
            title={order.client?.name || "Sin nombre"}
            subtitle={order.id ? `#${order.id.slice(0, 8).toLowerCase()}` : undefined}
            fields={[
              { label: "Fecha", value: new Date(order.date).toLocaleDateString() },
              { label: "Tipo de venta", value: order.saleType || "Delivery" },
              {
                label: "Estado",
                value: (
                  <span className={completed ? "text-emerald-600" : "text-amber-600"}>
                    {orderStatusLabel(order)}
                  </span>
                ),
                emphasis: "strong",
              },
            ]}
            onSelect={() => onView(order)}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => onAccept?.(order.id)}
                  aria-label={`Finalizar la orden ${order.id}`}
                  title="Finalizar orden"
                  className="flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition-colors active:bg-emerald-600 active:text-white"
                >
                  <HiOutlineCheck size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onChat?.(order.id, order.client?.name)}
                  aria-label={`Abrir el chat con ${order.client?.name || "el cliente"}`}
                  title="Chat con el cliente"
                  className="flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors active:bg-amber-600 active:text-white"
                >
                  <HiOutlineChatAlt2 size={18} aria-hidden="true" />
                </button>
              </>
            }
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Dirección
                </dt>
                <dd className="break-words font-bold capitalize text-slate-600">
                  {order.client?.direccion || "N/A"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Total
                </dt>
                <dd className="truncate font-bold text-slate-600">
                  {`$ ${(Number(order.totalreal) || 0).toFixed(2)}`}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Documento
                </dt>
                <dd className="truncate font-bold text-slate-600">
                  {order.client?.documento || "—"}
                </dd>
              </div>
            </dl>
          </RecordCard>
        );
      })}
    </ul>
  );
}
