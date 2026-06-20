"use client";
import { useState, useCallback } from "react";
import { HiX } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { customerService, type Customer } from "@/modules/customers/api/customer.service";

const DOC_PREFIXES = ["V", "J", "E"] as const;
type DocPrefix = (typeof DOC_PREFIXES)[number];

const PHONE_PREFIXES = ["0412", "0414", "0416", "0424", "0426", "0418", "0212"];

// Helpers para dividir/combinar documento y teléfono
function splitDocument(fullDoc: string) {
  const prefix = fullDoc.charAt(0).toUpperCase();
  if (DOC_PREFIXES.includes(prefix as DocPrefix)) {
    return { prefix: prefix as DocPrefix, number: fullDoc.slice(1) };
  }
  return { prefix: "V" as DocPrefix, number: fullDoc };
}

function combineDocument(prefix: DocPrefix, number: string) {
  return prefix + number;
}

function splitPhone(fullPhone: string) {
  const found = PHONE_PREFIXES.find((p) => fullPhone.startsWith(p));
  if (found) {
    return { prefix: found, number: fullPhone.slice(found.length) };
  }
  return { prefix: PHONE_PREFIXES[0], number: fullPhone };
}

function combinePhone(prefix: string, number: string) {
  return prefix + number;
}

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

  // Inicializar estados directamente desde el cliente (sin useEffect)
  const initialDoc = splitDocument(client?.documento || "");
  const initialPhone = splitPhone(client?.phone || "");

  const [docPrefix, setDocPrefix] = useState<DocPrefix>(initialDoc.prefix);
  const [docNumber, setDocNumber] = useState(initialDoc.number);
  const [phonePrefix, setPhonePrefix] = useState(initialPhone.prefix);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.number);
  const [name, setName] = useState(client?.name || "");
  const [email, setEmail] = useState(client?.email || "");
  const [direccion, setDireccion] = useState(client?.direccion || "");
  const [retencion, setRetencion] = useState(client?.retencion || "0");
  const [userFound, setUserFound] = useState(client?.found === "true");

  const [loadingDocument, setLoadingDocument] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Actualizar documento y teléfono en el store cuando cambien
  const updateDocumento = useCallback(() => {
    setCustomerField("documento", combineDocument(docPrefix, docNumber));
  }, [docPrefix, docNumber, setCustomerField]);

  const updatePhone = useCallback(() => {
    setCustomerField("phone", combinePhone(phonePrefix, phoneNumber));
  }, [phonePrefix, phoneNumber, setCustomerField]);

  // Función auxiliar para limpiar campos cuando se cambia el documento
  const clearFieldsOnChange = () => {
    if (userFound) {
      setUserFound(false);
      setCustomerField("found", "false");
      setName("");
      setEmail("");
      setPhoneNumber("");
      setDireccion("");
      setRetencion("0");
      // Limpiar también en el store
      setCustomerField("name", "");
      setCustomerField("email", "");
      setCustomerField("phone", "");
      setCustomerField("direccion", "");
      setCustomerField("retencion", "0");
    }
  };

  // Manejadores de cambio
  const handleNameChange = (val: string) => {
    setName(val);
    setCustomerField("name", val);
    if (userFound) { setUserFound(false); setCustomerField("found", "false"); }
  };
  const handleEmailChange = (val: string) => {
    setEmail(val);
    setCustomerField("email", val);
    if (userFound) { setUserFound(false); setCustomerField("found", "false"); }
  };
  const handleDireccionChange = (val: string) => {
    setDireccion(val);
    setCustomerField("direccion", val);
    if (userFound) { setUserFound(false); setCustomerField("found", "false"); }
  };
  const handleRetencionChange = (val: string) => {
    setRetencion(val);
    setCustomerField("retencion", val);
  };

  const handleDocPrefixChange = (prefix: DocPrefix) => {
    setDocPrefix(prefix);
    if (prefix !== "J") {
      setRetencion("0");
      setCustomerField("retencion", "0");
    }
    updateDocumento();
    clearFieldsOnChange(); // Limpiar si había un cliente encontrado
  };

  const handleDocNumberChange = (val: string) => {
    setDocNumber(val);
    updateDocumento();
    setSearchError(null);
    clearFieldsOnChange(); // Limpiar si había un cliente encontrado
  };

  const handlePhonePrefixChange = (val: string) => {
    setPhonePrefix(val);
    updatePhone();
    if (userFound) { setUserFound(false); setCustomerField("found", "false"); }
  };

  const handlePhoneNumberChange = (val: string) => {
    setPhoneNumber(val);
    updatePhone();
    if (userFound) { setUserFound(false); setCustomerField("found", "false"); }
  };

  // Búsqueda por documento
  const handleDocumentSearch = useCallback(async () => {
    const documento = combineDocument(docPrefix, docNumber).trim();
    if (!documento) return;

    let cedula = docNumber.trim();
    if (docPrefix === "J" && cedula.length < 9) {
      setSearchError("El RIF debe tener 9 dígitos");
      setFormError(null);
      return;
    } else if (docPrefix !== "J" && (cedula.length < 7 || cedula.length > 8)) {
      setSearchError("La cédula debe tener entre 7 y 8 dígitos");
      setFormError(null);
      return;
    }

    setLoadingDocument(true);
    setSearchError(null);

    try {
      const customer = await customerService.searchByDocument(documento.toUpperCase());
      if (customer) {
        const doc = splitDocument(customer.documento || documento);
        setDocPrefix(doc.prefix);
        setDocNumber(doc.number);
        const ph = splitPhone(customer.phone || "");
        setPhonePrefix(ph.prefix);
        setPhoneNumber(ph.number);
        setName(customer.name || "");
        setEmail(customer.email || "");
        setDireccion(customer.direccion || "");
        setRetencion(customer.retencion || "0");
        setUserFound(true);

        // Actualizar store
        setCustomerField("documento", combineDocument(doc.prefix, doc.number));
        setCustomerField("name", customer.name || "");
        setCustomerField("email", customer.email || "");
        setCustomerField("phone", combinePhone(ph.prefix, ph.number));
        setCustomerField("direccion", customer.direccion || "");
        setCustomerField("retencion", customer.retencion || "0");
        setCustomerField("found", "true");
      } else {
        setSearchError("Cliente no registrado. Complete todos los campos.");
        setUserFound(false);
        setCustomerField("found", "false");
        setRetencion("0");
        setCustomerField("retencion", "0");
      }
    } catch {
      setSearchError("Sin conexión — no se pudo verificar el usuario.");
      setUserFound(false);
    } finally {
      setLoadingDocument(false);
    }
  }, [docPrefix, docNumber, setCustomerField]);

  const handleDocNumberBlur = () => {
    updateDocumento();
    handleDocumentSearch();
  };

  const validateForm = (): boolean => {
    const documento = combineDocument(docPrefix, docNumber).trim();
    if (!documento) { setFormError("Debe ingresar una cédula o RIF."); return false; }
    if (docPrefix === "J" && docNumber.length < 9) { setFormError("El RIF debe tener 9 dígitos."); return false; }
    if (docPrefix !== "J") {
      if (docNumber.length < 7 || docNumber.length > 8) { setFormError("La cédula debe tener entre 7 y 8 dígitos."); return false; }
      if (!/^\d+$/.test(docNumber)) { setFormError("La cédula debe contener solo números."); return false; }
    }
    if (!userFound) {
      if (!name.trim()) { setFormError("El nombre es obligatorio."); return false; }
      if (!email.trim()) { setFormError("El email es obligatorio."); return false; }
      if (!combinePhone(phonePrefix, phoneNumber).trim()) { setFormError("El teléfono es obligatorio."); return false; }
      if (!direccion.trim()) { setFormError("La dirección es obligatoria."); return false; }
    }
    return true;
  };

  const handleContinue = () => {
    updateDocumento();
    updatePhone();
    setCustomerField("retencion", docPrefix === "J" ? retencion : "0");
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
            formError ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            {formError || searchError}
          </div>
        )}

        <div className="space-y-4">
          {/* Documento */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Cédula / RIF</label>
            <div className="flex gap-2">
              {/* Select siempre habilitado para permitir correcciones */}
              <select
                value={docPrefix}
                onChange={(e) => handleDocPrefixChange(e.target.value as DocPrefix)}
                className="w-16 px-2 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {DOC_PREFIXES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => handleDocNumberChange(e.target.value)}
                  onBlur={handleDocNumberBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleDocNumberBlur(); } }}
                  placeholder="12345678"
                  className="w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {loadingDocument && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              readOnly={userFound}
              placeholder="Nombre del cliente"
              className={`w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                readOnly={userFound}
                placeholder="correo@ejemplo.com"
                className={`w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
              />
            </div>

            {/* Teléfono con prefijo */}
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Teléfono *</label>
              <div className="flex gap-1">
                <select
                  value={phonePrefix}
                  onChange={(e) => handlePhonePrefixChange(e.target.value)}
                  disabled={userFound}
                  className="w-[68px] px-1 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-70"
                >
                  {PHONE_PREFIXES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumberChange(e.target.value)}
                  readOnly={userFound}
                  placeholder="1234567"
                  className={`flex-1 min-w-0 px-3 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
                />
              </div>
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Dirección *</label>
            <textarea
              value={direccion}
              onChange={(e) => handleDireccionChange(e.target.value)}
              readOnly={userFound}
              placeholder="Dirección de entrega"
              rows={2}
              className={`w-full px-4 py-3 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 resize-none ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
            />
          </div>

          {/* Retención (solo jurídico) */}
          {docPrefix === "J" && (
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Retención</label>
              <select
                value={retencion}
                onChange={(e) => handleRetencionChange(e.target.value)}
                disabled={userFound}
                className={`w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 ${userFound ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <option value="0">0%</option>
                <option value="75">75%</option>
                <option value="100">100%</option>
              </select>
            </div>
          )}

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