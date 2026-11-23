"use client";

import { RiDeleteBin6Line, RiCloseLine } from "react-icons/ri";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title: string;
  itemName: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmDialog({
  isOpen,
  title,
  itemName,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-300 sm:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div className="rounded-2xl bg-red-50 p-3">
            <RiDeleteBin6Line size={28} className="text-red-500" />
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-xl p-2 transition-colors hover:bg-gray-100 max-sm:flex max-sm:min-h-11 max-sm:min-w-11 max-sm:items-center max-sm:justify-center"
          >
            <RiCloseLine size={24} className="text-gray-400" />
          </button>
        </div>

        <h3 className="mb-2 break-words text-2xl font-black text-gray-800">{title}</h3>
        <p className="mb-8 break-words font-medium leading-relaxed text-gray-500">
          ¿Estás seguro que deseas eliminar{" "}
          <span className="font-bold text-gray-800">"{itemName}"</span>? Esta
          acción no se puede deshacer.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="min-w-0 flex-1 rounded-2xl bg-gray-50 px-2 py-4 font-bold text-gray-500 transition-all hover:bg-gray-100 active:scale-95 disabled:opacity-50"
          >
            <span className="block break-words leading-tight">Cancelar</span>
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex min-w-0 flex-[1.5] items-center justify-center gap-2 rounded-2xl bg-red-500 px-2 py-4 font-bold text-white shadow-lg shadow-red-100 transition-all hover:bg-red-600 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="size-5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span className="min-w-0 break-words leading-tight">Eliminando...</span>
              </>
            ) : (
              <span className="min-w-0 break-words leading-tight">Confirmar Eliminación</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
