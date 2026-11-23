"use client";
import { HiOutlineDocumentText, HiOutlineEye } from "react-icons/hi";
import RecordCard from "@/components/ui/record-card";
import type { FacturaListItem, NotaCreditoResumen } from "../types";

interface FacturasCardListProps {
  facturas: FacturaListItem[];
  isLoading: boolean;
  ncPorFactura: Record<string, NotaCreditoResumen[]>;
  onOpenDetail: (factura: FacturaListItem) => void;
  onOpenNotaCredito: (factura: FacturaListItem) => void;
}

/** `YYYY-MM-DD` + hour, local, for the field row (the full stamp is in the disclosure). */
function shortDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function SkeletonCard() {
  return (
    <li className="animate-pulse rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-28 rounded bg-slate-100" />
          <div className="h-3 w-40 rounded bg-slate-100" />
        </div>
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
 * The invoice list on a phone (spec S7): the seven-column table of
 * `FacturasTable` — `min-w-[900px]`, horizontally scrolled — becomes one card per
 * invoice with the five fields an operator reads to decide (control number,
 * customer, total, date and state). RIF, the dollar total, the rate and any
 * credit note go behind the card's disclosure.
 *
 * The row actions are always visible and at least 44×44 (specs S3, S5): on a
 * phone the table's `opacity-0 group-hover:opacity-100` cell never appeared, so
 * neither the PDF nor the credit note was reachable. Tapping the card body opens
 * the detail, exactly like tapping the desktop row.
 */
export default function FacturasCardList({
  facturas,
  isLoading,
  ncPorFactura,
  onOpenDetail,
  onOpenNotaCredito,
}: FacturasCardListProps) {
  if (isLoading) {
    return (
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </ul>
    );
  }

  if (facturas.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center text-sm font-bold text-slate-400">
        No hay facturas con estos filtros.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {facturas.map((f) => {
        const notasCredito = ncPorFactura[f.id] ?? [];

        return (
          <RecordCard
            key={f.id}
            title={<span className="font-mono tracking-tight">{f.numero_control}</span>}
            subtitle={f.cliente_nombre}
            fields={[
              {
                label: "Total",
                value: `Bs ${f.total_ves.toFixed(2)}`,
                emphasis: "strong",
              },
              { label: "Fecha", value: shortDate(f.fecha_emision) },
              {
                label: "Estado",
                value: (
                  <span
                    className={
                      notasCredito.length > 0 ? "text-amber-600" : "text-emerald-600"
                    }
                  >
                    {notasCredito.length > 0 ? "Con nota de crédito" : "Emitida"}
                  </span>
                ),
                emphasis: "strong",
              },
            ]}
            onSelect={() => onOpenDetail(f)}
            actions={
              <>
                {f.url_pdf ? (
                  <a
                    href={f.url_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver PDF de la factura ${f.numero_control}`}
                    title="Ver PDF"
                    className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors active:bg-slate-100"
                  >
                    <HiOutlineEye size={18} aria-hidden="true" />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenNotaCredito(f)}
                  aria-label={`Emitir nota de crédito de la factura ${f.numero_control}`}
                  title="Emitir nota de crédito"
                  className="flex items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 transition-colors active:bg-emerald-100"
                >
                  <HiOutlineDocumentText size={18} aria-hidden="true" />
                </button>
              </>
            }
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  RIF
                </dt>
                <dd className="truncate font-bold text-slate-600">
                  {f.cliente_rif || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Total USD
                </dt>
                <dd className="truncate font-bold text-slate-600">
                  $ {f.total_usd.toFixed(2)}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Emitida
                </dt>
                <dd className="font-bold text-slate-600">
                  {f.fecha_emision
                    ? new Date(f.fecha_emision).toLocaleString("es-VE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                    : "—"}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Notas de crédito
                </dt>
                <dd className="font-bold text-slate-600">
                  {notasCredito.length === 0
                    ? "Sin notas de crédito"
                    : notasCredito
                        .map((nc) => `${nc.numero_control} · Bs ${nc.total_ves.toFixed(2)}`)
                        .join(" · ")}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  PDF
                </dt>
                <dd className="font-bold text-slate-600">
                  {f.url_pdf ? "Disponible" : "No disponible"}
                </dd>
              </div>
            </dl>
          </RecordCard>
        );
      })}
    </ul>
  );
}
