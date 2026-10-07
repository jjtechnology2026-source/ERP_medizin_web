/**
 * Fechas de calendario LOCAL.
 *
 * Para construir un filtro de fecha NO se debe usar `toISOString()`: devuelve la
 * fecha en UTC. En una zona al oeste de UTC (Venezuela, UTC−4) pasadas las 20:00
 * ya devuelve el día siguiente; en una zona al este, a la mañana devuelve el día
 * anterior. Un filtro armado así puede dejar fuera de la lista los documentos
 * recién creados, que es exactamente lo que no queremos cuando alguien revisa el
 * día en curso.
 *
 * El límite superior es el peligroso: si el reloj de la PC está atrasado, una
 * fecha "hasta" calculada con ese reloj esconde lo recién emitido. Por eso las
 * pantallas de listado no deberían poner un "hasta" por defecto.
 *
 * Excepción deliberada: `todayUtcDate()` en `ZReportDialog` usa UTC a propósito,
 * porque ahí la fecha es la fecha fiscal del Z y la define el backend.
 */

/** Fecha local en formato `YYYY-MM-DD`. */
export function localDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Fecha local de hace `days` días, en formato `YYYY-MM-DD`. */
export function daysAgoStr(days: number, now: Date = new Date()): string {
  return localDateStr(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - days),
  );
}

/**
 * Offset fijo de Venezuela respecto a UTC, en horas (UTC−4). Venezuela no tiene
 * DST desde 2016, así que un offset constante es correcto; es la misma decisión
 * que `fiscal_calendar::VET_UTC_OFFSET_SECS` del backend. Se fija acá y no se lee
 * del reloj/TZ del operador: un cliente fuera de Caracas debe mandar el mismo
 * rango que uno en Caracas.
 */
const CARACAS_UTC_OFFSET_HOURS = -4;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Instante UTC de la medianoche de Caracas del día `day` (`YYYY-MM-DD`),
 * desplazado `addDays` días. 00:00 Caracas equivale a 04:00Z del mismo día.
 */
function caracasMidnightIso(day: string, addDays = 0): string {
  if (!DAY_RE.test(day)) {
    throw new Error(`Día inválido para el límite comercial: "${day}"`);
  }
  const [year, month, date] = day.split("-").map(Number);
  return new Date(
    Date.UTC(
      year,
      month - 1,
      date + addDays,
      -CARACAS_UTC_OFFSET_HOURS,
      0,
      0,
      0,
    ),
  ).toISOString();
}

/**
 * Límite inferior (inclusive) del día comercial Caracas para un filtro
 * `date.start`. `businessDayStartIso("2026-10-06")` = `2026-10-06T04:00:00.000Z`.
 */
export function businessDayStartIso(day: string): string {
  return caracasMidnightIso(day, 0);
}

/**
 * Límite superior del día comercial Caracas para un filtro `date.end`, en el
 * **último milisegundo** del día `day`: `businessDayEndIso("2026-10-06")` =
 * `2026-10-07T03:59:59.999Z`. Sirve tanto para un backend que compara
 * `date < $end` como para uno que compara `date <= $end`.
 */
export function businessDayEndIso(day: string): string {
  return new Date(Date.parse(caracasMidnightIso(day, 1)) - 1).toISOString();
}
