"use client";

import { useMqttOrders } from "../providers/MqttOrdersProvider";
import MarketplaceOrderModal from "./MarketplaceOrderModal";
import ModalWrapper from "@/components/shared/modals/ModalWrapper";
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineExclamation } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";

export default function GlobalOrderNotifications() {
  const { 
    currentOrder, 
    secondsLeft, 
    acceptOrder, 
    rejectOrder, 
    dismissOrder,
    feedback,
    clearFeedback,
    mqttError,
    clearMqttError,
  } = useMqttOrders();

  const handleAccept = async () => {
    await acceptOrder();
  };

  const handleReject = async () => {
    await rejectOrder();
  };

  return (
    <>
      {mqttError && (
        <div className="fixed bottom-4 right-4 z-[300] max-w-sm bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-lg flex items-start gap-3">
          <HiOutlineExclamation className="text-amber-500 w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800">Conexión MQTT</p>
            <p className="text-xs text-amber-600 mt-0.5">{mqttError}</p>
          </div>
          <button onClick={clearMqttError} className="text-amber-400 hover:text-amber-600 shrink-0">
            <HiOutlineXCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Real-time Order Modal */}
      <MarketplaceOrderModal
        order={currentOrder}
        secondsLeft={secondsLeft}
        onAccept={handleAccept}
        onClose={dismissOrder}
      />

      {/* Feedback Modals */}
      <ModalWrapper 
        isOpen={feedback.type !== "none"} 
        onClose={clearFeedback}
        zIndex={200}
      >
        <div className="p-8 flex flex-col items-center gap-6 text-center min-w-[320px]">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12 }}
          >
            {feedback.type === "success" ? (
              <HiOutlineCheckCircle className="text-emerald-500 w-20 h-20" />
            ) : (
              <HiOutlineXCircle className="text-rose-500 w-20 h-20" />
            )}
          </motion.div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              {feedback.title}
            </h2>
            <p className="text-slate-500 font-medium leading-relaxed max-w-[280px]">
              {feedback.message}
            </p>
          </div>

          <button
            onClick={clearFeedback}
            className={`w-full py-4 rounded-2xl font-black text-white transition-all active:scale-95 shadow-lg ${
              feedback.type === "success" 
                ? "bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700" 
                : "bg-rose-500 shadow-rose-100 hover:bg-rose-600"
            }`}
          >
            Entendido
          </button>
        </div>
      </ModalWrapper>
    </>
  );
}
