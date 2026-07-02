"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiX, HiPaperAirplane } from "react-icons/hi";
import { mqttServer } from "@/modules/core/mqtt/advanced-service";
import { MQTT_TOPICS } from "@/modules/core/mqtt/topics";
import { getChatMessages, addChatMessage } from "@/modules/core/store/chat.store";
import type { ChatMessage } from "@/modules/core/store/chat.store";

interface ChatModalProps {
  orderId: string;
  clientName?: string;
  onClose: () => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sameSender(a: ChatMessage, b: ChatMessage) {
  return a.sender === b.sender;
}

function initials(name?: string) {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

export default function ChatModal({ orderId, clientName, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(getChatMessages(orderId));
    inputRef.current?.focus();
  }, [orderId]);

  useEffect(() => {
    const unsub = mqttServer.onMessage((topic, payload) => {
      if (topic !== MQTT_TOPICS.clientToPharmacy(orderId)) return;
      try {
        const raw = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
        const data = JSON.parse(raw);
        if (data.text) {
          const msg: ChatMessage = { text: data.text, sender: "client", timestamp: data.timestamp || Date.now() };
          addChatMessage(orderId, msg);
          setMessages((prev) => [...prev, msg]);
        }
      } catch {}
    });

    return () => { unsub(); };
  }, [orderId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");

    const msg: ChatMessage = { text, sender: "pharmacy", timestamp: Date.now() };
    addChatMessage(orderId, msg);
    setMessages((prev) => [...prev, msg]);

    mqttServer.publish(MQTT_TOPICS.pharmacyToClient(orderId), JSON.stringify(msg)).catch(() => {});
    inputRef.current?.focus();
  }, [input, orderId]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 bg-white rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4A69BD] to-[#6c8be0] flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm">
              {initials(clientName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-800 truncate">Chat con {clientName || "Cliente"}</p>
              <p className="text-[11px] text-slate-400 font-medium truncate">#{orderId.slice(0, 10)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-all active:scale-90">
            <HiX size={20} className="text-slate-400" />
          </button>
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-1 min-h-[340px] max-h-[420px] bg-[#F8FAFC]"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 #F8FAFC" }}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full pt-16 select-none">
              <div className="w-14 h-14 rounded-full bg-[#4A69BD]/5 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-[#4A69BD]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-400">Esperando mensaje del cliente...</p>
              <p className="text-[11px] text-slate-300 mt-1">Los mensajes aparecerán aquí automáticamente</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m, i) => {
              const prev = i > 0 ? messages[i - 1] : null;
              const isGroupStart = !prev || prev.sender !== m.sender;
              const showAvatar = m.sender === "client" && isGroupStart;

              return (
                <motion.div
                  key={`${m.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={`flex items-end gap-2 ${m.sender === "pharmacy" ? "justify-end" : "justify-start"} ${isGroupStart ? "mt-3" : "mt-0.5"}`}
                >
                  {showAvatar && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4A69BD] to-[#6c8be0] flex items-center justify-center text-white text-[10px] font-black shrink-0">
                      {initials(clientName)}
                    </div>
                  )}
                  {!showAvatar && m.sender === "client" && <div className="w-7 shrink-0" />}

                  <div className="flex flex-col max-w-[80%]">
                    <div
                      className={`px-4 py-2.5 text-sm leading-relaxed ${
                        m.sender === "pharmacy"
                          ? "bg-[#4A69BD] text-white rounded-[18px] rounded-br-[6px] shadow-sm"
                          : "bg-white border border-slate-200 text-slate-700 rounded-[18px] rounded-bl-[6px] shadow-sm"
                      }`}
                    >
                      {m.text}
                    </div>
                    {isGroupStart && (
                      <span className={`text-[10px] text-slate-400 mt-1 px-1 ${m.sender === "pharmacy" ? "text-right" : "text-left"}`}>
                        {formatTime(m.timestamp)}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escribí un mensaje..."
            className="flex-1 px-5 py-3 bg-[#F1F5F9] border border-transparent rounded-2xl text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#4A69BD]/30 transition-all"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="w-11 h-11 flex items-center justify-center bg-[#4A69BD] text-white rounded-2xl hover:bg-[#3a5aad] disabled:opacity-30 transition-all active:scale-90 shadow-sm"
          >
            <HiPaperAirplane size={18} className="rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}
