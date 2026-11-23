"use client";

import { HiOutlineExclamation, HiOutlineCheckCircle } from "react-icons/hi";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Sheet from "@/components/ui/sheet";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "success" | "warning" | "info";
  isLoading?: boolean;
}

/**
 * The confirmation everyone reuses (logout, deletes, irreversible steps).
 *
 * It is a `Sheet`, so on a phone it arrives as a bottom sheet with the primary
 * action under the thumb, and from 640px up it is the same centered dialog as
 * before. The props did not change, so every existing caller keeps working and
 * desktop behaviour is untouched (spec S4).
 */
export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "warning",
  isLoading = false,
}: ConfirmationDialogProps) {
  const iconMap = {
    danger: <HiOutlineExclamation size={22} />,
    warning: <HiOutlineExclamation size={22} />,
    success: <HiOutlineCheckCircle size={22} />,
    info: <HiOutlineExclamation size={22} />,
  };

  const badgeMap = {
    danger: "bg-red-50 text-red-500",
    warning: "bg-amber-50 text-amber-500",
    success: "bg-emerald-50 text-emerald-500",
    info: "bg-blue-50 text-blue-500",
  };

  const btnMap = {
    danger: "bg-red-600 hover:bg-red-700 shadow-red-200",
    warning: "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
    success: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
    info: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              badgeMap[variant],
            )}
          >
            {iconMap[variant]}
          </span>
          <span>{title}</span>
        </span>
      }
      description={description}
      footer={
        // Stacked on a phone (primary last, closest to the thumb), side by side
        // from `sm` up — the same order the dialog had before.
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="min-h-14 flex-1 rounded-2xl bg-slate-50 font-black text-slate-400 transition-all hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50 sm:min-h-0 sm:py-4"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "flex min-h-14 items-center justify-center gap-2 rounded-2xl font-black text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 sm:min-h-0 sm:flex-[1.5] sm:py-4",
              btnMap[variant],
            )}
          >
            {isLoading ? (
              <div className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      }
    />
  );
}
