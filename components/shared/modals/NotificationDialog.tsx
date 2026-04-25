"use client";

import { useEffect, useState } from "react";
import {
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiCloseLine,
} from "react-icons/ri";
import ModalWrapper from "./ModalWrapper";

interface NotificationDialogProps {
  isOpen: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  onClose: () => void;
}

export function NotificationDialog({
  isOpen,
  type,
  title,
  message,
  onClose,
}: NotificationDialogProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
    } else {
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!show) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} zIndex={1000}>
      <div
        className={`bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl flex flex-col items-center text-center ${
          isOpen ? "scale-100 translate-y-0" : "scale-90 translate-y-4"
        }`}
      >
        <div className="relative mb-6">
          {type === "success" ? (
            <div className="bg-green-100 p-4 rounded-full animate-bounce">
              <RiCheckboxCircleFill size={64} className="text-green-500" />
            </div>
          ) : (
            <div className="bg-red-100 p-4 rounded-full animate-pulse">
              <RiCloseCircleFill size={64} className="text-red-500" />
            </div>
          )}
        </div>

        <h3 className="text-2xl font-black text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-500 font-medium leading-relaxed mb-8">
          {message}
        </p>

        <button
          onClick={onClose}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 ${
            type === "success"
              ? "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
              : "bg-red-600 hover:bg-red-700 shadow-red-100"
          }`}
        >
          Cerrar
        </button>
      </div>
    </ModalWrapper>
  );
}
