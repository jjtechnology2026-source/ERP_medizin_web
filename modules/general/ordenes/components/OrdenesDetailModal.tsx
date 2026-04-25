"use client";

import { useEffect, useRef } from "react";
import { RiCloseLine } from "react-icons/ri";
import { Ordenes } from "../types/ordenes.constants";

interface OrdenesDetailModalProps {
  order: Ordenes | null;
  onClose: () => void;
}

export function OrdenesDetailModal({
  order,
  onClose,
}: OrdenesDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    if (order) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [order, onClose]);

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">
            Detalles de la orden
          </h2>
          <button
            onClick={onClose}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-red-200"
          >
            Cerrar
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 md:p-8 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 h-fit">
              <DetailItem label="Cédula" value={order.client.documento} />
              <DetailItem label="Cliente" value={order.client.name} />
              <DetailItem label="Dirección" value={order.address} />
              <DetailItem
                label="Género"
                value={order.gender === "Male" ? "Masculino" : "Femenino"}
              />
              <div className="md:col-span-1">
                <DetailItem
                  label="Número de la orden"
                  value={order.facturacion?.resp?.numerointerno || "N/A"}
                />
              </div>
              <DetailItem label="ID de Rastreo" value={order.id} />
              <DetailItem label="Tipo" value={order.saleType} />
              <DetailItem label="Agente" value={order.client.name} />
              <DetailItem
                label="Fecha y hora"
                value={new Date(order.date).toLocaleString()}
              />
              <DetailItem label="Estado" value={order.saleStatus} />
              <div /> {/* Spacer */}
              <DetailItem
                label="Tasa de cambio"
                value={`${order.rate.toFixed(2)} Bs`}
              />
              <DetailItem
                label="Total Sistema"
                value={`${order.totalsystem.toFixed(2)} USD / ${(order.totalsystem * order.rate).toLocaleString("de-DE", { minimumFractionDigits: 2 })} BS`}
              />
              <DetailItem
                label="Total Real"
                value={`${order.totalreal.toFixed(2)} USD / ${(order.totalreal * order.rate).toLocaleString("de-DE", { minimumFractionDigits: 2 })} BS`}
              />
              <DetailItem
                label="Controlado"
                value={order.isControlled ? "Si" : "No"}
              />
              <DetailItem
                label="Observación"
                value={order.observation || "N/A"}
              />
            </div>

            {/* Medicamentos */}
            <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0">
              <div className="bg-gray-100/50 rounded-2xl p-4 h-full border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">
                  Lista de medicamentos:
                </h3>

                <div className="grid grid-cols-[80px_1fr_80px] gap-2 mb-2">
                  <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1.5 rounded-lg text-center">
                    Cant.
                  </div>
                  <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1.5 rounded-lg">
                    Producto
                  </div>
                  <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1.5 rounded-lg text-right">
                    Precio
                  </div>
                </div>

                <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                  {order.medications.map((med, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[80px_1fr_80px] gap-2 items-center px-1 py-1 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-sm font-medium text-gray-800 text-center">
                        {med.quantity}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800">
                          {med.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {med.dosage} - {med.brand}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-sm font-bold text-gray-800 leading-none">
                          {(med.price * order.rate).toLocaleString("de-DE", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          BS
                        </span>
                        <span className="text-[10px] text-blue-500 font-bold mt-1">
                          ${med.price.toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-bold text-gray-900 mb-0.5">{label}:</span>
      <span className="text-sm text-gray-600 leading-snug break-words">
        {value}
      </span>
    </div>
  );
}
