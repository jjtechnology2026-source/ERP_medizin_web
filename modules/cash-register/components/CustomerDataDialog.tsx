"use client";
import { useState, useEffect } from "react";
import { HiX } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";

const VENEZUELAN_BANKS = [
  "Banco de Venezuela", "Banco Mercantil", "Banco Provincial", "Banco Banesco",
  "Banco Occidental de Descuento", "Banco Nacional de Crédito", "Banco del Tesoro",
  "Banco Exterior", "Banco Caroní", "Banco Sofitasa", "Banco Plaza", "Banco Activo",
  "Bancamiga", "Banco Fondo Común", "Banco del Sur", "Banco Agrícola de Venezuela",
  "100% Banco", "Banco de la Gente", "Banco Bancrecer", "Mi Banco",
  "Banco Digital de Venezuela (BDV)", "Banco Venezolano de Crédito", "Banco Banplus",
  "Banco BICENTENARIO", "Banco BANDES", "Banco BNC", "Banco BOD", "Banco Banfanb",
];

export default function CustomerDataDialog({
  onClose,
  onContinue,
}: {
  onClose: () => void;
  onContinue: () => void;
}) {
  const { setCustomerField, getCurrentOrder } = useCurrentOrderStore();
  const order = getCurrentOrder();
  const client = order?.client;

  const [form, setForm] = useState({
    documento: client?.documento || "",
    name: client?.name || "",
    email: client?.email || "",
    phone: client?.phone || "",
    direccion: client?.direccion || "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setCustomerField(field, value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800">Datos del Cliente</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiX size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">
              Cédula / RIF
            </label>
            <input
              type="text"
              value={form.documento}
              onChange={(e) => handleChange("documento", e.target.value)}
              placeholder="V-12345678"
              className="w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Teléfono</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="0412-1234567"
                className="w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Dirección</label>
            <textarea
              value={form.direccion}
              onChange={(e) => handleChange("direccion", e.target.value)}
              placeholder="Dirección de entrega"
              rows={2}
              className="w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onContinue}
            className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] transition-all"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
