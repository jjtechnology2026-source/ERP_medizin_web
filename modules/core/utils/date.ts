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
