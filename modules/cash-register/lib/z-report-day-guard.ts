/**
 * Guardia "un solo reporte Z por dia y por maquina fiscal".
 *
 * El caso real que motiva esto: una persona cierra el dia y otra persona, mas
 * tarde, emite un segundo Z sobre la misma maquina porque nada se lo impide.
 * Por eso la verificacion NUNCA se apoya en localStorage (ese registro no se
 * comparte entre equipos): se consulta el libro de ventas del dia en el
 * backend y se compara contra el serial de ESTA maquina fiscal.
 *
 * La impresion fisica no se puede deshacer: este modulo solo decide si hay que
 * mostrar el aviso antes de disparar el Z.
 */

export interface ZReportDayEntry {
  zNumber: number | null;
  fiscalSerial: string | null;
  fiscalDate: string;
}

export type ZGuardStatus = "none" | "duplicate" | "unverified";

/** Con que alcance se comparo: serial de la maquina o toda la farmacia. */
export type ZGuardScope = "serial" | "pharmacy";

/** Que provoco la coincidencia (para explicarlo en el modal). */
export type ZGuardMatchedBy = "serial" | "fallback" | "pharmacy" | "none";

export interface ZReportDayGuardResult {
  status: ZGuardStatus;
  scope: ZGuardScope;
  machineSerial: string | null;
  match: ZReportDayEntry | null;
  matchedBy: ZGuardMatchedBy;
  todayCount: number;
  /** Motivo legible cuando el aviso degrada o no se pudo verificar. */
  note: string | null;
}

export const Z_GUARD_SERIAL_NOTE =
  "No se pudo leer el serial de esta máquina fiscal: el aviso se comparó contra todos los reportes Z del día de la farmacia.";

export const Z_GUARD_UNVERIFIED_NOTE =
  "No se pudo verificar si ya hay un reporte Z hoy: el listado del día no respondió. Revisá antes de emitir para no duplicar el cierre.";

/**
 * Serial fiscal comparable: mayusculas y sin separadores, porque la maquina y
 * el backend no siempre lo devuelven con el mismo formato ("Z1F 1234567").
 */
export function normalizeFiscalSerial(serial?: string | null): string | null {
  const cleaned = String(serial ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return cleaned ? cleaned : null;
}

export function pickMachineSerial(
  candidates: Array<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    const normalized = normalizeFiscalSerial(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function dayOf(date?: string | null): string {
  return String(date ?? "").trim().slice(0, 10);
}

/**
 * Serial sintetico de un Z que salio por la POS80: buildFallbackZReport lo
 * arma como `${pharmacyId}-${fecha}-${z}`. Ese Z no es de la maquina fiscal,
 * pero si cerro el dia en esta farmacia.
 */
export function isFallbackSerial(
  fiscalSerial: string | null | undefined,
  pharmacyId: string,
): boolean {
  const serial = normalizeFiscalSerial(fiscalSerial);
  const pharmacy = normalizeFiscalSerial(pharmacyId);
  if (!serial || !pharmacy) return false;
  return serial.startsWith(pharmacy);
}

/**
 * Serial de maquina utilizable. Descarta el sintetico de un Z que salio por la
 * POS80: tomarlo como "esta maquina fiscal" escondería un cierre ya hecho y el
 * aviso no apareceria.
 */
export function usableMachineSerial(
  serial: string | null | undefined,
  pharmacyId: string,
): string | null {
  const normalized = pickMachineSerial([serial]);
  if (!normalized) return null;
  return isFallbackSerial(normalized, pharmacyId) ? null : normalized;
}

export function evaluateZReportDayGuard(input: {
  /** false cuando el listado del dia no respondio. */
  fetchOk: boolean;
  reports: ZReportDayEntry[];
  /** Serial de esta maquina fiscal, si se pudo leer. */
  machineSerial?: string | null;
  pharmacyId: string;
  /** Fecha fiscal del dia que se esta cerrando (calendario Caracas). */
  fiscalDate: string;
  /** false = facturacion digital: no hay maquina fiscal que distinguir. */
  preferSerial?: boolean;
  todayCount?: number;
}): ZReportDayGuardResult {
  const preferSerial = input.preferSerial ?? true;
  const serial = pickMachineSerial([input.machineSerial]);
  const scope: ZGuardScope = preferSerial && serial ? "serial" : "pharmacy";

  if (!input.fetchOk) {
    return {
      status: "unverified",
      scope,
      machineSerial: serial,
      match: null,
      matchedBy: "none",
      todayCount: 0,
      note: Z_GUARD_UNVERIFIED_NOTE,
    };
  }

  const today = (input.reports || []).filter(
    (report) => dayOf(report?.fiscalDate) === dayOf(input.fiscalDate),
  );

  if (scope === "serial" && serial) {
    const bySerial = today.find(
      (report) => normalizeFiscalSerial(report?.fiscalSerial) === serial,
    );
    if (bySerial) {
      return {
        status: "duplicate",
        scope: "serial",
        machineSerial: serial,
        match: bySerial,
        matchedBy: "serial",
        todayCount: today.length,
        note: null,
      };
    }
    // Misma farmacia, papel salido por la POS80 con la maquina caida: cerro el
    // dia igual, y su serial sintetico nunca va a coincidir con el real.
    const byFallback = today.find((report) =>
      isFallbackSerial(report?.fiscalSerial, input.pharmacyId),
    );
    if (byFallback) {
      return {
        status: "duplicate",
        scope: "serial",
        machineSerial: serial,
        match: byFallback,
        matchedBy: "fallback",
        todayCount: today.length,
        note: null,
      };
    }
    return {
      status: "none",
      scope: "serial",
      machineSerial: serial,
      match: null,
      matchedBy: "none",
      todayCount: today.length,
      note: null,
    };
  }

  const anyToday = today[0] ?? null;
  return {
    status: anyToday ? "duplicate" : "none",
    scope: "pharmacy",
    machineSerial: serial,
    match: anyToday,
    matchedBy: anyToday ? "pharmacy" : "none",
    todayCount: today.length,
    // Se pidio comparar por maquina pero no hay serial: hay que decirlo.
    note: preferSerial && !serial ? Z_GUARD_SERIAL_NOTE : null,
  };
}

/**
 * Orquestacion con dependencias inyectadas: la lectura del serial de la
 * impresora y el listado del dia son responsabilidad del llamador, para que
 * esta logica siga siendo probable sin red ni hardware.
 */
export async function resolveZReportDayGuard(deps: {
  pharmacyId: string;
  fiscalDate: string;
  preferSerial: boolean;
  readMachineSerial: () => Promise<string | null> | string | null;
  fetchToday: () => Promise<{ ok: boolean; reports: ZReportDayEntry[] }>;
}): Promise<ZReportDayGuardResult> {
  let machineSerial: string | null = null;
  if (deps.preferSerial) {
    try {
      machineSerial = pickMachineSerial([await deps.readMachineSerial()]);
    } catch {
      machineSerial = null;
    }
  }

  let fetched: { ok: boolean; reports: ZReportDayEntry[] };
  try {
    fetched = await deps.fetchToday();
  } catch {
    fetched = { ok: false, reports: [] };
  }

  return evaluateZReportDayGuard({
    fetchOk: fetched.ok,
    reports: fetched.reports ?? [],
    machineSerial,
    pharmacyId: deps.pharmacyId,
    fiscalDate: deps.fiscalDate,
    preferSerial: deps.preferSerial,
  });
}
