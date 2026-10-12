/**
 * Normaliza un valor de fecha de Excel (u otro origen) a ISO `YYYY-MM-DD`.
 *
 * Acepta:
 * - `Date` (cuando XLSX.read usa `cellDates: true`)
 * - serial numérico de Excel (sistema 1900)
 * - string ISO `YYYY-MM-DD`
 * - string `DD/MM/YYYY` o `DD-MM-YYYY`
 *
 * Devuelve `undefined` si el valor está vacío o no es parseable (se trata como "sin vencimiento").
 */
export function toIsoDate(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? undefined : raw.toISOString().slice(0, 10);
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    // ponytail: serial de Excel (25569 = días entre 1970-01-01 y 1899-12-30)
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return undefined;
}
