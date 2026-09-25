import React, { useState } from "react";
import { motion } from "framer-motion";
import { RiCloseLine, RiCalendarLine } from "react-icons/ri";

interface Props {
  startDate: string | null; // Usamos string (YYYY-MM-DD) para inputs de fecha
  endDate: string | null;
  onConfirm: (start: string | null, end: string | null) => void;
  onClose: () => void;
}

export const DateRangeFilterDialog = ({
  startDate: initialStart,
  endDate: initialEnd,
  onConfirm,
  onClose,
}: Props) => {
  const [start, setStart] = useState<string | null>(initialStart);
  const [end, setEnd] = useState<string | null>(initialEnd);

  return (
    <div className="absolute top-full left-0 mt-2 z-[100] w-[300px]">
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        className="bg-white rounded-[26px] p-5 shadow-2xl border border-gray-100 flex flex-col gap-3 origin-top-left"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-[18px] font-bold text-[#202224]">
            Filtrar por fecha
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <RiCloseLine size={24} />
          </button>
        </div>

        {/* Input Desde */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#202224] ml-1">
            Desde
          </label>
          <div className="relative">
            <input
              type="date"
              className="w-full bg-[#F5F6FA] border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#516EFA]/20 appearance-none"
              value={start || ""}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
        </div>

        {/* Input Hasta */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#202224] ml-1">
            Hasta
          </label>
          <div className="relative">
            <input
              type="date"
              className="w-full bg-[#F5F6FA] border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#516EFA]/20 appearance-none"
              value={end || ""}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        {/* Botón Aceptar (ActionButton) */}
        <button
          onClick={() => {
            onConfirm(start, end);
            onClose();
          }}
          className="w-full bg-[#516EFA] hover:bg-[#3f57cc] text-white font-bold py-3 rounded-xl mt-2 transition-all shadow-lg active:scale-[0.95]"
        >
          Aceptar
        </button>
      </motion.div>
    </div>
  );
};
