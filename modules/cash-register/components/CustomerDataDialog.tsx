"use client";
import { useState, useCallback, useEffect } from "react";
import { HiX } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { customerService, type Customer } from "@/modules/customers/api/customer.service";

export default function CustomerDataDialog({
  onClose,
  onContinue,
}: {
  onClose: () => void;
  onContinue: () => void;
}) {
  const { setCustomerField, getCurrentOrder } = useCurrentOrderStore();
  const order = getCurrentOrder();
  const client = order?.client as (Customer & { found?: string }) | undefined;

  const [form, setForm] = useState({
    documento: client?.documento || "",
    name: client?.name || "",
    email: client?.email || "",
    phone: client?.phone || "",
    direccion: client?.direccion || "",
    retencion: client?.retencion || "0", // ← nuevo
  });

  const [loadingDocument, setLoadingDocument] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [userFound, setUserFound] = useState(client?.found === "true");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const updatedClient = order?.client as (Customer & { found?: string }) | undefined;
    if (updatedClient) {
      setForm({
        documento: updatedClient.documento || "",
        name: updatedClient.name || "",
        email: updatedClient.email || "",
        phone: updatedClient.phone || "",
        direccion: updatedClient.direccion || "",
        retencion: updatedClient.retencion || "0",
      });
      setUserFound(updatedClient.found === "true");
    }
  }, [order?.client]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setCustomerField(field, value);
    if (userFound && field !== "documento" && field !== "retencion") {
      setUserFound(false);
      setCustomerField("found", "false");
    }
    setFormError(null);
  };

  const handleDocumentSearch = useCallback(async () => {
    const documento = form.documento.trim();
    if (!documento) return;

    let cedula = documento;
    const firstChar = cedula[0].toUpperCase();

    if (firstChar === "J") {
      if (cedula.length < 9) {
        setSearchError("El RIF debe tener 9 dígitos");
        setFormError(null);
        return;
      }
    } else if (!/^[0-9]/.test(cedula)) {
      cedula = cedula.substring(1);
    }

    if (cedula.length < 7 || cedula.length > 8) {
      setSearchError("La cédula debe tener entre 7 y 8 dígitos");
      setFormError(null);
      return;
    }

    setLoadingDocument(true);
    setSearchError(null);

    try {
      const customer = await customerService.searchByDocument(documento.toUpperCase());

      if (customer) {
        const newForm = {
          documento: customer.documento || documento,
          name: customer.name || "",
          email: customer.email || "",
          phone: customer.phone || "",
          direccion: customer.direccion || "",
          retencion: customer.retencion || "0",
        };
        setForm(newForm);
        setUserFound(true);
        Object.entries(newForm).forEach(([field, value]) => setCustomerField(field, value));
        setCustomerField("found", "true");
      } else {
        setSearchError("Cliente no registrado. Debe completar todos los campos.");
        setUserFound(false);
        setCustomerField("found", "false");
      }
    } catch {
      setSearchError("Sin conexión — no se pudo verificar el usuario.");
      setUserFound(false);
    } finally {
      setLoadingDocument(false);
    }
  }, [form.documento, setCustomerField]);

  const validateForm = (): boolean => {
    const documento = form.documento.trim();
    if (!documento) {
      setFormError("Debe ingresar una cédula o RIF.");
      return false;
    }

    let cedula = documento;
    const firstChar = cedula[0].toUpperCase();
    if (firstChar === "J") {
      if (cedula.length < 9) {
        setFormError("El RIF debe tener 9 dígitos.");
        return false;
      }
    } else {
      if (!/^[0-9]/.test(cedula)) {
        cedula = cedula.substring(1);
      }
      if (cedula.length < 7 || cedula.length > 8) {
        setFormError("La cédula debe tener entre 7 y 8 dígitos.");
        return false;
      }
      if (!/^\d+$/.test(cedula)) {
        setFormError("La cédula debe contener solo números.");
        return false;
      }
    }

    if (!userFound) {
      if (!form.name.trim()) {
        setFormError("El nombre es obligatorio.");
        return false;
      }
      if (!form.email.trim()) {
        setFormError("El email es obligatorio.");
        return false;
      }
      if (!form.phone.trim()) {
        setFormError("El teléfono es obligatorio.");
        return false;
      }
      if (!form.direccion.trim()) {
        setFormError("La dirección es obligatoria.");
        return false;
      }
    }

    return true;
  };

  const handleContinue = () => {
    if (!validateForm()) return;
    onContinue();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg mx-4 p-6 text-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800">Datos del Cliente</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiX size={20} />
          </button>
        </div>

        {(formError || searchError) && (
          <div className={`mb-4 p-3 border rounded-xl text-sm font-medium ${
            formError
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            {formError || searchError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">
              Cédula / RIF
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.documento}
                onChange={(e) => {
                  handleChange("documento", e.target.value);
                  setSearchError(null);
                }}
                onBlur={handleDocumentSearch}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleDocumentSearch();
                  }
                }}
                placeholder="V-12345678"
                className="w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 pr-10"
              />
              {loadingDocument && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              readOnly={userFound}
              placeholder="Nombre del cliente"
              className={`w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                readOnly={userFound}
                placeholder="correo@ejemplo.com"
                className={`w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Teléfono *</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                readOnly={userFound}
                placeholder="0412-1234567"
                className={`w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Dirección *</label>
            <textarea
              value={form.direccion}
              onChange={(e) => handleChange("direccion", e.target.value)}
              readOnly={userFound}
              placeholder="Dirección de entrega"
              rows={2}
              className={`w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 resize-none ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
            />
          </div>

          {/* Nuevo campo: Retención */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Retención</label>
            <select
              value={form.retencion}
              onChange={(e) => handleChange("retencion", e.target.value)}
              disabled={userFound}
              className={`w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <option value="0">0%</option>
              <option value="75">75%</option>
              <option value="100">100%</option>
            </select>
          </div>

          {!userFound && (
            <p className="text-[10px] text-slate-400">* Campos obligatorios para clientes nuevos</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] transition-all"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}