"use client";

import { ReactNode, useId, useState } from "react";
import { HiOutlineChevronDown } from "react-icons/hi";
import { cn } from "@/modules/core/utils/ui";

export interface RecordCardField {
  label: string;
  value: ReactNode;
  /** Decision fields (price, stock, estado) are usually emphasised. */
  emphasis?: "default" | "strong" | "muted";
}

interface RecordCardProps {
  title: ReactNode;
  /** Line under the title: SKU, folio, or any second identity field. */
  subtitle?: ReactNode;
  /** The 2–3 fields an agent reads to decide. Always visible, never on hover. */
  fields?: RecordCardField[];
  /** Row actions. Each one must render a control of at least 44×44 (S3). */
  actions?: ReactNode;
  /** Turns the whole card into one touchable target (44px+ everywhere). */
  onSelect?: () => void;
  /** The remaining fields, behind an explicit disclosure (spec S7). */
  children?: ReactNode;
  detailLabel?: string;
  collapseLabel?: string;
  className?: string;
}

const fieldValueClass = {
  default: "text-slate-600",
  strong: "text-slate-900",
  muted: "text-slate-400",
} as const;

/**
 * The list row that replaces a wide table on a phone (spec S7).
 *
 * One card = one record: a title, the two or three fields that drive the
 * decision, and the row actions. Everything else goes behind an explicit
 * disclosure — nothing is reachable only on hover (spec S5). The card renders
 * an `<li>`, so it belongs inside a `<ul>`/`<ol>`.
 */
export default function RecordCard({
  title,
  subtitle,
  fields,
  actions,
  onSelect,
  children,
  detailLabel = "Ver más",
  collapseLabel = "Ver menos",
  className,
}: RecordCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const visibleFields = fields ?? [];

  return (
    <li
      className={cn(
        "relative flex min-h-16 flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black leading-snug text-slate-800">
            {onSelect ? (
              // Stretched target: the card is touchable as a whole, while the
              // accessible name stays the record's own title.
              <button
                type="button"
                onClick={onSelect}
                className="text-left after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-blue-500/50"
              >
                {title}
              </button>
            ) : (
              title
            )}
          </p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions ? (
          // Above the stretched target, and never below 44×44 (S3).
          <div className="relative z-10 flex shrink-0 items-center gap-2 [&>*]:min-h-11 [&>*]:min-w-11 [&_button]:min-h-11 [&_button]:min-w-11">
            {actions}
          </div>
        ) : null}
      </div>

      {visibleFields.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
          {visibleFields.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {field.label}
              </dt>
              <dd
                className={cn(
                  "truncate text-sm font-bold",
                  fieldValueClass[field.emphasis ?? "default"],
                )}
              >
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {children ? (
        <>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            className="relative z-10 -mx-1 flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-black uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            {isExpanded ? collapseLabel : detailLabel}
            <HiOutlineChevronDown
              size={16}
              aria-hidden="true"
              className={cn("transition-transform", isExpanded && "rotate-180")}
            />
          </button>

          {/* Above the stretched target, so interactive content inside the
              disclosure is not swallowed by the card tap. */}
          <div
            id={detailsId}
            hidden={!isExpanded}
            className="relative z-10 border-t border-slate-50 pt-2"
          >
            {children}
          </div>
        </>
      ) : null}
    </li>
  );
}
