"use client";
import { useState } from "react";
import {
  HiSearch,
  HiTrash,
  HiShoppingBag,
  HiDocumentText,
} from "react-icons/hi";
import ProductSearchDialog from "@/modules/cash-register/components/ProductSearchDialog";
import ManualAddDialog from "@/modules/cash-register/components/ManualAddDialog";
import PriceCheckDialog from "@/modules/cash-register/components/PriceCheckDialog";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";

export default function ActionButtons({ onCheckout }: { onCheckout: () => void }) {
  const [showSearch, setShowSearch] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showPriceCheck, setShowPriceCheck] = useState(false);
  const { deleteOrder, getCurrentOrder, removeMedication } = useCurrentOrderStore();

  const order = getCurrentOrder();
  const selectedIndex = -1; // to be connected to store for selected row

  const handleDeleteItem = () => {
    if (selectedIndex >= 0) {
      removeMedication(selectedIndex);
    }
  };

  const handleDeleteOrder = () => {
    if (order?.medications.length > 0) {
      deleteOrder();
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#4d6bfe] hover:bg-[#3b5bdb] text-white rounded-xl font-black text-[11px] tracking-wider shadow-xs hover:scale-105 active:scale-95 transition-all"
        >
          <HiShoppingBag size={15} />
          Agregar varios
        </button>
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl font-black text-[11px] tracking-wider shadow-xs hover:scale-105 active:scale-95 transition-all"
        >
          <HiSearch size={15} />
          Buscar
        </button>
        <button
          onClick={() => setShowPriceCheck(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-xl font-black text-[11px] tracking-wider shadow-xs hover:scale-105 active:scale-95 transition-all"
        >
          <HiDocumentText size={15} />
          Consultar
        </button>
        <button
          onClick={handleDeleteItem}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-xl font-black text-[11px] tracking-wider shadow-xs hover:scale-105 active:scale-95 transition-all"
        >
          <HiTrash size={15} />
          Eliminar Art.
        </button>
      </div>

      {showSearch && <ProductSearchDialog onClose={() => setShowSearch(false)} />}
      {showManual && <ManualAddDialog onClose={() => setShowManual(false)} />}
      {showPriceCheck && <PriceCheckDialog onClose={() => setShowPriceCheck(false)} />}
    </>
  );
}
