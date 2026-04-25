import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import api from "@/modules/core/api/client";

// Constantes
const ENTIDAD_MAP: Record<string, string> = {
  SMART: "SMART",
  "BANCO PLAZA": "0138",
  R4: "0169",
};

export const PHONE_PREFIXES = ["0412", "0422", "0414", "0424", "0416", "0426"];

const BANCOS_PAGO_MOVIL = [
  { label: "BANCO PLAZA (0138)", value: "0138" },
  { label: "R4 (0169)", value: "0169" },
];

export function useCrearFarmaciaForm(isOpen: boolean, onClose: () => void) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const [notification, setNotification] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  const [formData, setFormData] = useState({
    id_pharmacy: crypto.randomUUID(),
    nombreFarmacia: "",
    idGrupo: "",
    rifBody: "", // Solo números del RIF (8-9 dígitos)
    codigoSanitarioSuffix: "",
    phonePrefix: "0412",
    phoneBody: "",
    longitud: "",
    latitud: "",
    mppsSuffix: "",
    anniversary_month: "",
    titularCuenta: "",
    rifTitularBody: "", // Solo números
    numeroCuentaPrefix: "", // 4 dígitos
    numeroCuentaBody: "", // 16 dígitos
  });

  const [tokens, setTokens] = useState([{ entidad: "SMART", token: "" }]);
  const [pagoMovil, setPagoMovil] = useState([
    { bank: "0138", prefix: "0412", number: "", rif: "" },
  ]);

  // Helpers
  const formatRifForPagoMovil = (rif: string) => {
    // Si rif viene como J-12345678-9, quitar guiones y quitar ultimo digito
    return rif.replace(/-/g, "").slice(0, -1);
  };

  const toTitleCase = (str: string) => {
    return str
      .split(" ")
      .map((word) => {
        // Si la palabra ya está toda en mayúsculas (ej: CA, SA, USA), mantenerla
        if (word === word.toUpperCase() && word.length > 1) return word;
        // Si no, capitalizar primera letra
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  };

  // Construye el RIF completo J-12345678-9
  const buildRif = (body: string) => {
    if (!body) return "";
    const clean = body.replace(/\D/g, "");
    if (clean.length < 2) return `J-${clean}`; // Fallback simple
    const suffix = clean.slice(-1);
    const prefix = clean.slice(0, -1);
    return `J-${prefix}-${suffix}`;
  };

  // Handlers
  const handleNameChange = (val: string) => {
    setFormData({ ...formData, nombreFarmacia: toTitleCase(val) });
  };

  const handleAccountHolderChange = (val: string) => {
    setFormData({ ...formData, titularCuenta: toTitleCase(val) });
  };

  const handlePhoneBodyChange = (val: string) => {
    const numeric = val.replace(/\D/g, "").slice(0, 7);
    setFormData({ ...formData, phoneBody: numeric });
  };

  const handleRifBodyChange = (val: string) => {
    const numeric = val.replace(/\D/g, "").slice(0, 9); // Max 9 digits
    setFormData({ ...formData, rifBody: numeric });
  };

  const handleRifTitularBodyChange = (val: string) => {
    const numeric = val.replace(/\D/g, "").slice(0, 9);
    setFormData({ ...formData, rifTitularBody: numeric });
  };

  const handleAccountPrefixChange = (val: string) => {
    const numeric = val.replace(/\D/g, "").slice(0, 4);
    setFormData({ ...formData, numeroCuentaPrefix: numeric });
  };

  const handleAccountBodyChange = (val: string) => {
    const numeric = val.replace(/\D/g, "").slice(0, 16);
    setFormData({ ...formData, numeroCuentaBody: numeric });
  };

  const handleMppsChange = (val: string) => {
    setFormData({ ...formData, mppsSuffix: val });
  };

  const handleHealthCodeChange = (val: string) => {
    setFormData({ ...formData, codigoSanitarioSuffix: val });
  };

  // Gestión de Arrays (Tokens y Pago Móvil)
  const addTokenField = () =>
    tokens.length < 3 &&
    setTokens([...tokens, { entidad: "SMART", token: "" }]);
  const removeTokenField = (index: number) =>
    tokens.length > 1 && setTokens(tokens.filter((_, i) => i !== index));
  const updateTokenField = (
    index: number,
    field: "entidad" | "token",
    value: string,
  ) => {
    const newTokens = [...tokens];
    newTokens[index][field] = value;
    setTokens(newTokens);
  };

  const addPagoMovil = () =>
    pagoMovil.length < BANCOS_PAGO_MOVIL.length &&
    setPagoMovil([
      ...pagoMovil,
      { bank: "0138", prefix: "0412", number: "", rif: "" },
    ]);

  const removePagoMovil = (index: number) =>
    pagoMovil.length > 1 &&
    setPagoMovil(pagoMovil.filter((_, i) => i !== index));

  const updatePagoMovil = (index: number, field: string, value: string) => {
    const newPM = [...pagoMovil];
    newPM[index] = { ...newPM[index], [field]: value };
    if (field === "number") {
      // Limit 7 digits
      newPM[index].number = value.replace(/\D/g, "").slice(0, 7);
    }
    setPagoMovil(newPM);
  };

  // Data fetching
  const { data: groupsData } = useApiQuery<any[]>(
    ["groups-list"],
    "/admin/PharmacyGroup/groupsPharmacy",
    { enabled: isOpen },
  );

  const groupOptions = useMemo(() => {
    if (!groupsData || !Array.isArray(groupsData)) return [];
    return groupsData.map((g: any, index: number) => ({
      label: g.name_group || g.name || `Grupo #${index + 1}`,
      value: `${g.id || g.id_group || "unknown"}::${index}`,
    }));
  }, [groupsData]);

  // Mutation
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const cleanIdGrupo = formData.idGrupo.split("::")[0];
      const fullPhone = `+58${formData.phonePrefix.substring(1)}${formData.phoneBody}`;
      const fullRif = buildRif(formData.rifBody);
      const fullRifTitular = buildRif(formData.rifTitularBody);
      const fullAccount = `${formData.numeroCuentaPrefix}${formData.numeroCuentaBody}`;

      const pharmacyPayload = {
        id_pharmacy: formData.id_pharmacy,
        name: formData.nombreFarmacia,
        id_group: cleanIdGrupo,
        rif: fullRif,
        health_code: `HC-${formData.codigoSanitarioSuffix}`,
        geolocation: {
          type: "Point",
          coordinates: [
            parseFloat(formData.longitud) || 0,
            parseFloat(formData.latitud) || 0,
          ],
        },
        telephone_number: fullPhone,
        mpps: `MPPS-${formData.mppsSuffix}`,
        anniversary_month: formData.anniversary_month,
        image: "https://medizins.com/default-pharmacy.jpg",
        agents: ["ag-001"],
        medications: [],
        account_payment: [
          {
            // FIX: Array wrap
            name: formData.titularCuenta,
            bank_account: fullAccount,
            cedula: fullRifTitular,
          },
        ],
        payment_pago_movil: pagoMovil.map((pm) => ({
          bank: pm.bank,
          number: `+58${pm.prefix.substring(1)}${pm.number}`,
          rif: formatRifForPagoMovil(pm.rif || fullRif),
        })),
      };

      // console.log("[PHARMACY PAYLOAD]:", pharmacyPayload);

      try {
        await api.post("/admin/Pharmacy/createpharmacy", pharmacyPayload);
      } catch (err: any) {
        throw err;
      }

      const tokensPayload = tokens
        .filter((t) => t.token.trim() !== "")
        .map((t) => ({
          id_pharmacy: formData.id_pharmacy,
          token: t.token,
          entidad: ENTIDAD_MAP[t.entidad] || t.entidad,
        }));

      try {
        if (tokensPayload.length > 0) {
          await api.post("/admin/TokenCustodian/insert_token", tokensPayload);
        }
      } catch (err: any) {
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farmacias"] });
      setNotification({
        show: true,
        type: "success",
        title: "Registro Exitoso",
        message: "La farmacia y sus tokens han sido creados correctamente.",
      });
      // Reset form
      setFormData({
        id_pharmacy: crypto.randomUUID(),
        nombreFarmacia: "",
        idGrupo: "",
        rifBody: "",
        codigoSanitarioSuffix: "",
        phonePrefix: "0412",
        phoneBody: "",
        longitud: "",
        latitud: "",
        mppsSuffix: "",
        anniversary_month: "",
        titularCuenta: "",
        rifTitularBody: "",
        numeroCuentaPrefix: "",
        numeroCuentaBody: "",
      });
      setTokens([{ entidad: "SMART", token: "" }]);
      setPagoMovil([{ bank: "0138", prefix: "0412", number: "", rif: "" }]);
      setStep(1);
    },
    onError: (err: any) => {
      console.error("[ERROR FINAL]", err);
      console.error("[DETALLE SERVIDOR]", err.response?.data);

      const serverMsg =
        err.response?.data?.message || err.response?.data?.error;
      const msg = serverMsg || err.message || "Error desconocido";

      setNotification({
        show: true,
        type: "error",
        title: "Error de Servidor (400)",
        message: `Fallo: ${msg}. Revisa la consola par más detalles técnicos.`,
      });
    },
  });

  const handleContinue = () => {
    // Validaciones
    if (step === 1 && (!formData.nombreFarmacia || !formData.idGrupo))
      return alert("Faltan datos");
    if (step === 2 && (!formData.rifBody || !formData.codigoSanitarioSuffix))
      return alert("Faltan datos");
    if (step === 3 && !formData.latitud) return alert("Falta ubicación");
    if (
      step === 4 &&
      (!formData.numeroCuentaPrefix || !formData.numeroCuentaBody)
    )
      return alert("Faltan datos bancarios");
    if (step === 5 && pagoMovil.some((p) => !p.number))
      return alert("Completa los números de pago móvil");
    if (step === 6 && tokens.some((t) => !t.token))
      return alert("Completa los tokens");

    if (step < 6) setStep(step + 1);
    else mutate();
  };

  return {
    step,
    setStep,
    formData,
    setFormData,
    handleNameChange,
    handleAccountHolderChange,
    handlePhoneBodyChange,
    handleRifBodyChange,
    handleRifTitularBodyChange,
    handleAccountPrefixChange,
    handleAccountBodyChange,
    handleMppsChange,
    handleHealthCodeChange,
    tokens,
    addTokenField,
    removeTokenField,
    updateTokenField,
    pagoMovil,
    addPagoMovil,
    removePagoMovil,
    updatePagoMovil,
    groupOptions,
    isPending,
    handleContinue,
    notification,
    setNotification,
    geoStatus,
    setGeoStatus,
    BANCOS_PAGO_MOVIL,
    formatRifForPagoMovil,
    buildRif,
  };
}
