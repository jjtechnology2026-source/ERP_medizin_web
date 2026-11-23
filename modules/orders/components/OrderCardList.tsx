"use client";
import { HiOutlineEye } from "react-icons/hi";
import RecordCard from "@/components/ui/record-card";
import type { Order } from "../types/orders";

/** Shape carrying the order status: the backend may send `saleStatus` or (legacy) `sale_status`. */
type StatusCarrier = { saleStatus?: string | null; sale_status?: string | null };

const statusKey = (order: StatusCarrier | null | undefined): string =>
  String(order?.saleStatus ?? order?.sale_status ?? "").trim().toLowerCase();

const statusLabel = (key: string): string => {
  switch (key) {
    case "completed":
    case "completada":
    case "entregada":
      return "Completado";
    case "cancelled":
    case "cancelada":
    case "canceled":
      return "Cancelado";
    case "pending":
    case "pendiente":
      return "Pendiente";
    case "paid":
      return "Pagado";
    case "pipelinefailed":
      return "Falló el proceso";
    default:
      return key || "Pendiente";
  }
};

const statusTone = (key: string): string => {
  switch (key) {
    case "completed":
    case "completada":
    case "entregada":
      return "text-emerald-600";
    case "cancelled":
    case "cancelada":
    case "canceled":
      return "text-rose-600";
    case "paid":
      return "text-sky-600";
    case "pipelinefailed":
      return "text-red-600";
    default:
      return "text-amber-600";
  }
};

interface OrderCardListProps {
  orders: Order[];
  loading: boolean;
  emptyMessage: string;
  onOpenDetail: (order: Order) => void;
  /** `Bs`/`$` formatting of the order total, shared with the desktop table. */
  formatOrderTotal: (total: number) => string;
}

const orderDate = (order: Order): string =>
  new Date(order.date || (order as any).fecha || Date.now()).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const saleTypeLabel = (order: Order): string => {
  const type = String(order.saleType || (order as any).sale_type || "").trim();
  if (!type) return "—";
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

function SkeletonCard() {
  return (
    <li className="animate-pulse rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-slate-100" />
          <div className="h-3 w-20 rounded bg-slate-100" />
        </div>
        <div className="size-11 rounded-xl bg-slate-100" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="h-8 rounded bg-slate-100" />
        <div className="h-8 rounded bg-slate-100" />
        <div className="h-8 rounded bg-slate-100" />
      </div>
    </li>
  );
}

/**
 * The order list on a phone (spec S7): the eight-column `min-w-[1000px]` table of
 * `OrderListTable` becomes one card per order with the fields the agent decides
 * with — customer, number, date, total and status. Address, delivery type and the
 * full identifier go behind the disclosure.
 *
 * The detail button is always visible and 44×44 (specs S3, S5); tapping the card
 * body opens the same detail, like clicking the desktop row did.
 */
export default function OrderCardList({
  orders,
  loading,
  emptyMessage,
  onOpenDetail,
  formatOrderTotal,
}: OrderCardListProps) {
  if (loading) {
    return (
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </ul>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center text-sm font-bold text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {orders.map((order) => {
        const key = statusKey(order);
        const id = String(order.id || (order as any).idOrder || "");
        // One unbroken address token used to widen the whole card; it now breaks
        // and the full value lives in the disclosure, so nothing is hidden.
        const address = order.client?.direccion || (order as any).address || "";

        return (
          <RecordCard
            key={id || `${order.date}-${order.nameAgent}`}
            title={order.client?.name || (order as any).clientName || "Cliente General"}
            subtitle={id ? `#${id.slice(0, 8)}` : undefined}
            fields={[
              {
                label: "Total",
                value: formatOrderTotal(
                  Number(order.totalreal !== undefined ? order.totalreal : (order as any).total_real) || 0,
                ),
                emphasis: "strong",
              },
              { label: "Fecha", value: orderDate(order) },
              {
                label: "Estado",
                value: <span className={statusTone(key)}>{statusLabel(key)}</span>,
                emphasis: "strong",
              },
            ]}
            onSelect={() => onOpenDetail(order)}
            actions={
              <button
                type="button"
                onClick={() => onOpenDetail(order)}
                aria-label={`Ver detalle de la orden ${id.slice(0, 8)}`}
                title="Ver detalle"
                className="flex items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#4A69BD] transition-colors active:bg-blue-100"
              >
                <HiOutlineEye size={18} aria-hidden="true" />
              </button>
            }
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Tipo de entrega
                </dt>
                <dd className="truncate font-bold text-slate-600">{saleTypeLabel(order)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Agente
                </dt>
                <dd className="truncate font-bold text-slate-600">{order.nameAgent || "—"}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Dirección
                </dt>
                <dd
                  className="font-bold capitalize text-slate-600 wrap-break-word"
                  title={address}
                >
                  {address || "—"}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Número de la orden
                </dt>
                <dd className="break-all font-mono text-[11px] font-bold text-slate-500">
                  {id || "—"}
                </dd>
              </div>
            </dl>
          </RecordCard>
        );
      })}
    </ul>
  );
}
