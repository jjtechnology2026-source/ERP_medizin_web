// Montos que el cajero cuenta fisicamente antes de cerrar el turno.
//
// Una sola definicion de los campos de conteo: la usa la grilla de escritorio y
// el sheet de conteo del telefono (T6). Los nombres de campo se mantienen tal
// cual los espera `requestCloseSession`, que no cambia.

export interface PhysicalCount {
  efectivo_ves: number;
  efectivo_usd: number;
  tarjeta_ves: number;
  pagomovil_ves: number;
  biopago_ves: number;
  cashea_ves: number;
  otros_ves: number;
  divisa_electronica_usd: number;
}

export interface CountField {
  field: keyof PhysicalCount;
  /** Etiqueta visible; el sufijo Bs/USD distingue la moneda del conteo. */
  label: string;
}

/** Solo los montos que se cuentan: `otros_ves` se persiste pero no se pide. */
export const COUNT_FIELDS: CountField[] = [
  { field: "efectivo_ves", label: "Efectivo Bs" },
  { field: "efectivo_usd", label: "Efectivo USD" },
  { field: "tarjeta_ves", label: "Tarjeta Bs" },
  { field: "pagomovil_ves", label: "Pago Móvil Bs" },
  { field: "biopago_ves", label: "Biopago Bs" },
  { field: "cashea_ves", label: "Cashea Bs" },
  { field: "divisa_electronica_usd", label: "Divisa Electrónica USD" },
];

export function emptyPhysicalCount(): PhysicalCount {
  return {
    efectivo_ves: 0,
    efectivo_usd: 0,
    tarjeta_ves: 0,
    pagomovil_ves: 0,
    biopago_ves: 0,
    cashea_ves: 0,
    otros_ves: 0,
    divisa_electronica_usd: 0,
  };
}

/** El input puede llegar vacio: se comporta como cero, igual que antes. */
export function parseCountInput(value: string): number {
  return parseFloat(value) || 0;
}

/** Cuantos de los montos pedidos ya tienen un valor distinto de cero. */
export function countFilledFields(counts: PhysicalCount): number {
  return COUNT_FIELDS.filter(({ field }) => counts[field] > 0).length;
}
