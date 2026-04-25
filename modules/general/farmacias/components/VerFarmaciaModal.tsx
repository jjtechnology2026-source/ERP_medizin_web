"use client";

import React, { useState } from "react";
import {
  RiCloseLine,
  RiStore2Line,
  RiMapPin2Line,
  RiFocus3Line,
  RiBankLine,
  RiSmartphoneLine,
} from "react-icons/ri";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

const BANCOS_PAGO_MOVIL = [
  { label: "BANCO PLAZA (0138)", value: "0138" },
  { label: "R4 (0169)", value: "0169" },
];

export function VerFarmaciaModal({
  isOpen,
  onClose,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: any;
}) {
  const [activeTab, setActiveTab] = useState<"resumen" | "general">("resumen");
  const profile = useAuthStore((state) => state.profile);

  if (!isOpen || !data) return null;

  const paymentData = (() => {
    if (Array.isArray(data.account_payment) && data.account_payment.length > 0)
      return data.account_payment[0];
    if (data.payment && !Array.isArray(data.payment)) return data.payment;
    return null;
  })();

  const pagoMovilList = Array.isArray(data.payment_pago_movil)
    ? data.payment_pago_movil
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-7 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="w-2 h-8 bg-[#dc2b1a] rounded-full"></span>
              <h2 className="text-2xl font-black text-gray-800 tracking-tight">
                Ficha Técnica
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
            >
              <RiCloseLine size={28} />
            </button>
          </div>

          <div className="flex gap-2 p-1.5 bg-gray-100 rounded-2xl w-fit">
            <TabNav
              active={activeTab === "resumen"}
              onClick={() => setActiveTab("resumen")}
              icon={<RiStore2Line />}
              label="Resumen"
            />
            <TabNav
              active={activeTab === "general"}
              onClick={() => setActiveTab("general")}
              icon={<RiMapPin2Line />}
              label="Ficha Detallada"
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar bg-white space-y-10">
          {activeTab === "resumen" ? (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Status Card */}
                <div className="p-6 rounded-[2rem] bg-gray-50 border border-gray-100 flex flex-col items-center justify-center text-center gap-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    Estado Operativo
                  </span>
                  <div
                    className={`px-6 py-2 rounded-2xl border-2 font-black text-lg ${
                      data.status === "AlDia"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : data.status === "PorPagar"
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : data.status === "Retrasada"
                            ? "bg-rose-50 text-rose-600 border-rose-200"
                            : "bg-blue-50 text-blue-600 border-blue-200"
                    }`}
                  >
                    {data.status === "AlDia"
                      ? "AL DÍA"
                      : data.status === "PorPagar"
                        ? "POR PAGAR"
                        : data.status === "Retrasada"
                          ? "RETRASADA"
                          : "PENDIENTE"}
                  </div>
                </div>

                {/* Modules Card */}
                <div className="p-6 rounded-[2rem] bg-gray-50 border border-gray-100 flex flex-col gap-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">
                    Módulos Activos
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {(data.active_modules || []).length > 0 ? (
                      data.active_modules.map((mod: string) => (
                        <div
                          key={mod}
                          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm"
                        >
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-xs font-black text-gray-700 uppercase tracking-tighter">
                            {mod === "DigitalBilling"
                              ? "Facturación"
                              : mod === "Accounting"
                                ? "Contabilidad"
                                : mod}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 italic text-sm">
                        Ningún módulo activo
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col gap-1">
                    <span className="text-[9px] font-black text-blue-400 uppercase">
                      RIF
                    </span>
                    <span className="text-sm font-black text-blue-700">
                      {data.rif}
                    </span>
                  </div>
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col gap-1 text-center">
                    <span className="text-[9px] font-black text-blue-400 uppercase">
                      Grupo
                    </span>
                    <span className="text-sm font-black text-blue-700">
                      {profile?.name_group}
                    </span>
                  </div>
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col gap-1 text-right">
                    <span className="text-[9px] font-black text-blue-400 uppercase">
                      Código
                    </span>
                    <span className="text-sm font-black text-blue-700">
                      {data.health_code}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-10 animate-in slide-in-from-left-4 duration-300">
              <Section title="Identificación" icon={<RiStore2Line size={18} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <InfoItem label="Nombre Fiscal" value={data.name} />
                  <InfoItem label="RIF" value={data.rif} />
                  <InfoItem
                    label="Grupo"
                    value={profile?.name_group || "---"}
                  />
                  <InfoItem label="Código Sanitario" value={data.health_code} />
                  <InfoItem label="MPPS" value={data.mpps} />
                  <InfoItem
                    label="Aniversario"
                    value={data.anniversary_month}
                  />
                  <InfoItem
                    label="Precio del Plan"
                    value={
                      data.custom_plan_price
                        ? `${data.custom_plan_price} USD`
                        : "Tarifa Base"
                    }
                  />
                </div>
              </Section>

              <Section title="Ubicación" icon={<RiMapPin2Line size={18} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InfoItem
                    label="Coordenadas"
                    value={
                      data.geolocation?.coordinates
                        ? `${data.geolocation.coordinates[1]}, ${data.geolocation.coordinates[0]}`
                        : "No registradas"
                    }
                  />
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest pl-0.5">
                      Mapa
                    </span>
                    {data.geolocation?.coordinates ? (
                      <a
                        href={`https://www.google.com/maps?q=${data.geolocation.coordinates[1]},${data.geolocation.coordinates[0]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1"
                      >
                        <RiFocus3Line /> Ver en Google Maps
                      </a>
                    ) : (
                      <span className="text-gray-300 italic text-sm">
                        Sin mapa disponible
                      </span>
                    )}
                  </div>
                </div>
              </Section>

              <Section title="Métodos de Pago" icon={<RiBankLine size={18} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-12 mb-10">
                  {paymentData ? (
                    <>
                      <InfoItem
                        label="Titular de Cuenta"
                        value={paymentData.name}
                      />
                      <InfoItem
                        label="Número de Cuenta"
                        value={paymentData.bank_account}
                        isCode
                      />
                      <InfoItem
                        label="Cédula/RIF Titular"
                        value={paymentData.cedula}
                      />
                    </>
                  ) : (
                    <p className="text-gray-400 italic text-sm col-span-full">
                      Sin información bancaria.
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <RiSmartphoneLine size={14} /> Cuentas de Pago Móvil
                  </h4>
                  {pagoMovilList.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pagoMovilList.map((pm: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-5 rounded-[1.5rem] bg-gray-50/50 border border-gray-100 flex flex-col gap-2"
                        >
                          <span className="text-[10px] font-black text-blue-600 uppercase">
                            Pago Móvil #{idx + 1}
                          </span>
                          <div className="flex justify-between">
                            <span className="text-gray-400 text-[11px] font-bold uppercase">
                              Banco:
                            </span>
                            <span className="font-black text-gray-700 text-sm">
                              {(() => {
                                const code = pm.bank || pm.banck;
                                const bancoEncontrado = BANCOS_PAGO_MOVIL.find(
                                  (b) => b.value === code,
                                );
                                return bancoEncontrado
                                  ? `${bancoEncontrado.label}`
                                  : code || "No especificado";
                              })()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400 text-[11px] font-bold uppercase">
                              Telf:
                            </span>
                            <span className="font-black text-gray-700 text-sm">
                              {pm.number}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400 text-[11px] font-bold uppercase">
                              RIF:
                            </span>
                            <span className="font-black text-gray-700 text-sm">
                              {pm.rif}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic text-sm">
                      No hay registros.
                    </p>
                  )}
                </div>
              </Section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-7 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-10 py-4 bg-gray-800 text-white font-black rounded-2xl hover:bg-black transition-all text-xs uppercase tracking-widest"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
}

function TabNav({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
        active
          ? "bg-white text-[#dc2b1a] shadow-sm scale-105"
          : "text-gray-400 hover:text-gray-600"
      }`}
    >
      {icon} <span>{label}</span>
    </button>
  );
}

function Section({ title, icon, children }: any) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-[#dc2b1a] text-[10px] font-black uppercase tracking-[0.3em] mb-7 flex items-center gap-3 border-l-4 border-[#dc2b1a] pl-3">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function InfoItem({ label, value, isCode }: any) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest pl-0.5">
        {label}
      </span>
      <span
        className={`text-base font-black text-gray-700 tracking-tight leading-tight ${isCode ? "font-mono text-gray-400" : ""}`}
      >
        {value || (
          <span className="text-gray-300 font-normal italic text-sm">---</span>
        )}
      </span>
    </div>
  );
}
