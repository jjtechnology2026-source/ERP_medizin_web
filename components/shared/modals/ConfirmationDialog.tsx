import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineExclamation, HiOutlineCheckCircle, HiOutlineX } from "react-icons/hi";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ModalWrapper from "./ModalWrapper";

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
    danger: <HiOutlineExclamation className="text-red-500" size={32} />,
    warning: <HiOutlineExclamation className="text-amber-500" size={32} />,
    success: <HiOutlineCheckCircle className="text-emerald-500" size={32} />,
    info: <HiOutlineExclamation className="text-blue-500" size={32} />,
  };

  const bgMap = {
    danger: "bg-red-50",
    warning: "bg-amber-50",
    success: "bg-emerald-50",
    info: "bg-blue-50",
  };

  const btnMap = {
    danger: "bg-red-600 hover:bg-red-700 shadow-red-200",
    warning: "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
    success: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
    info: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    isOpen ? (
      <ModalWrapper isOpen={isOpen} onClose={onClose} zIndex={9999}>
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-slate-100">
          <div className="p-8 md:p-10">
            <div className="flex justify-between items-start mb-6">
              <div className={cn("p-4 rounded-2xl", bgMap[variant])}>{iconMap[variant]}</div>
              <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <HiOutlineX size={24} />
              </button>
            </div>

            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">{title}</h3>
            <p className="text-slate-500 font-medium leading-relaxed mb-8">{description}</p>

            <div className="flex gap-4">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-4 rounded-2xl font-black text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  "flex-[1.5] py-4 rounded-2xl font-black text-white transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2",
                  btnMap[variant],
                )}
              >
                {isLoading ? (
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      </ModalWrapper>
    ) : null,
    document.body,
  );
}
