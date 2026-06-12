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
      <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-6">
          <div className="bg-red-50 p-3 rounded-2xl">
            <RiDeleteBin6Line size={28} className="text-red-500" />
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <RiCloseLine size={24} className="text-gray-400" />
          </button>
        </div>

        <h3 className="text-2xl font-black text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-500 font-medium leading-relaxed mb-8">
          ¿Estás seguro que deseas eliminar{" "}
          <span className="font-bold text-gray-800">"{itemName}"</span>? Esta
          acción no se puede deshacer.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-4 rounded-2xl font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-[1.5] py-4 rounded-2xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              "Confirmar Eliminación"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
