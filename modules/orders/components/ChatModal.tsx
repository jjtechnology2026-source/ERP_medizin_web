"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { HiOutlineChatAlt2, HiX } from "react-icons/hi";
import { mqttServer } from "@/modules/core/mqtt/advanced-service";
import { MQTT_TOPICS } from "@/modules/core/mqtt/topics";
import { getChatMessages, addChatMessage } from "@/modules/core/store/chat.store";
import type { ChatMessage } from "@/modules/core/store/chat.store";

interface ChatModalProps {
  orderId: string;
  clientName?: string;
  onClose: () => void;
}

export default function ChatModal({ orderId, clientName, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(getChatMessages(orderId));
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
  }, [input, orderId]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#4A69BD] flex items-center justify-center">
              <HiOutlineChatAlt2 className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800">Chat</h2>
              <p className="text-xs text-slate-400">{clientName || orderId.slice(0, 8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-all">
            <HiX size={20} className="text-slate-400" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-6 space-y-3 min-h-[320px] max-h-[400px] bg-slate-50/50">
          {messages.length === 0 && (
            <p className="text-center text-slate-300 text-sm font-medium pt-12">Sin mensajes aún</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender === "pharmacy" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.sender === "pharmacy"
                    ? "bg-[#4A69BD] text-white rounded-br-md"
                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-md"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 p-4 border-t border-slate-100">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escribí un mensaje..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#4A69BD] transition-colors"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="px-5 py-2.5 bg-[#4A69BD] text-white font-bold rounded-xl hover:bg-[#3a5aad] disabled:opacity-40 transition-all active:scale-95"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
