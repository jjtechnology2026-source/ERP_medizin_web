"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface ToastState {
  message: string;
  visible: boolean;
}

interface ChatToastContextValue {
  show: (message: string) => void;
}

const ChatToastContext = createContext<ChatToastContextValue | null>(null);

export function useChatToast() {
  const ctx = useContext(ChatToastContext);
  if (!ctx) throw new Error("useChatToast must be used within ChatToastProvider");
  return ctx;
}

export function ChatToastProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<ToastState>({ message: "", visible: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); return () => { if (timer.current) clearTimeout(timer.current); }; }, []);

  const show = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, visible: true });
    timer.current = setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 4000);
  }, []);

  return (
    <ChatToastContext.Provider value={{ show }}>
      {children}
      {mounted && createPortal(
        <div
          className={`fixed bottom-6 right-6 z-[9999] transition-all duration-300 ${
            toast.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl px-5 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] max-w-[360px]">
            <div className="w-7 h-7 rounded-full bg-[#4A69BD]/10 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-[#4A69BD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700 leading-tight">{toast.message}</p>
          </div>
        </div>,
        document.body,
      )}
    </ChatToastContext.Provider>
  );
}
