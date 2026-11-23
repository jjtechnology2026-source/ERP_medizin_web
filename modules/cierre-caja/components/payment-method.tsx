// Presentacion de los metodos de pago del cierre (icono, etiqueta y color).
//
// Las dos composiciones de la pantalla —tabla de escritorio y bloques de
// telefono— leen de aca, asi que la etiqueta y el icono de un metodo nunca se
// contradicen entre vistas (T6).

import {
  HiOutlineBookOpen,
  HiOutlineCash,
  HiOutlineClock,
  HiOutlineCreditCard,
  HiOutlineCurrencyDollar,
  HiOutlineDeviceMobile,
  HiOutlineFingerPrint,
  HiOutlineGlobe,
} from "react-icons/hi";
import type { CierreMethodKey } from "@/modules/cash-register/lib/cierre-caja";
import type { PhysicalCount } from "../lib/physical-count";

export type PaymentMethodKey = CierreMethodKey;

export const PAYMENT_METHOD_KEYS: PaymentMethodKey[] = [
  "efectivo",
  "dolares",
  "tarjeta",
  "pagomovil",
  "biopago",
  "cashea",
  "credito",
  "divisa_electronica",
];

export const METHOD_ICONS: Record<PaymentMethodKey, React.ReactNode> = {
  efectivo: <HiOutlineCash />,
  dolares: <HiOutlineCurrencyDollar />,
  tarjeta: <HiOutlineCreditCard />,
  pagomovil: <HiOutlineDeviceMobile />,
  biopago: <HiOutlineFingerPrint />,
  cashea: <HiOutlineClock />,
  credito: <HiOutlineBookOpen />,
  divisa_electronica: <HiOutlineGlobe />,
};

export const METHOD_LABELS: Record<PaymentMethodKey, string> = {
  efectivo: "Efectivo Bs.",
  dolares: "Divisas $",
  tarjeta: "Tarjetas",
  pagomovil: "Pago Móvil",
  biopago: "Biopago",
  cashea: "Cashea",
  credito: "Crédito",
  divisa_electronica: "Divisa Electrónica",
};

export const METHOD_COLORS: Record<PaymentMethodKey, string> = {
  efectivo: "text-emerald-500",
  dolares: "text-blue-500",
  tarjeta: "text-purple-500",
  pagomovil: "text-pink-500",
  biopago: "text-orange-500",
  cashea: "text-lime-500",
  credito: "text-rose-500",
  divisa_electronica: "text-teal-500",
};

export const METHOD_BG: Record<PaymentMethodKey, string> = {
  efectivo: "bg-emerald-50",
  dolares: "bg-blue-50",
  tarjeta: "bg-purple-50",
  pagomovil: "bg-pink-50",
  biopago: "bg-orange-50",
  cashea: "bg-lime-50",
  credito: "bg-rose-50",
  divisa_electronica: "bg-teal-50",
};

// Cada metodo del desglose lee su monto del campo correspondiente del conteo
// fisico (el nombre de campo no coincide con la clave de metodo).
export const COUNTED_FIELD_BY_METHOD: Record<PaymentMethodKey, keyof PhysicalCount> = {
  efectivo: "efectivo_ves",
  dolares: "efectivo_usd",
  tarjeta: "tarjeta_ves",
  pagomovil: "pagomovil_ves",
  biopago: "biopago_ves",
  cashea: "cashea_ves",
  credito: "otros_ves",
  divisa_electronica: "divisa_electronica_usd",
};
