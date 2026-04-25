"use client";
import { HiX } from "react-icons/hi";
import ModalWrapper from "../../../components/shared/modals/ModalWrapper";

interface NoteModalProps {
  isOpen: boolean;
  type: 'Crédito' | 'Débito';
  orderId: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function NoteModal({ isOpen, type, orderId, onClose, onConfirm }: NoteModalProps) {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} zIndex={110}>
      <div className="w-full max-w-sm overflow-hidden">
        <div className="p-10 text-center">
          <h3 className="text-[#4A69BD] text-xl font-black mb-4">Confirmar nota de {type.toLowerCase()}</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            ¿Deseas generar la nota de <span className="font-bold text-slate-700">{type.toLowerCase()}</span> para la orden?<br />
            <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full mt-2 inline-block">{orderId}</span>
          </p>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-[#FF3B30] text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-lg shadow-red-100 active:scale-95"
            >
              <HiX /> Cancelar
            </button>
            <button
              className="flex-1 py-4 bg-[#1D68EF] text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
              onClick={onConfirm}
            >
              ✓ Aceptar
            </button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}