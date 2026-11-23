/**
 * Qué lecturas del escáner se aceptan como código de producto.
 *
 * Existe por un bug real: en el mostrador, una etiqueta EAN-13 curva y mal
 * enfocada se decodificó como una simbología **sin dígito verificador** y la app
 * buscó un producto que no existía (`2026-11-23`, video de Jir: la caja decía
 * `7591519000948` y la pantalla buscó `0481718000948`).
 *
 * `Code39`, `ITF` y `Codabar` no llevan checksum: para ellas "isValid" solo
 * significa "se pudo decodificar", así que un barrido sucio devuelve una tira de
 * dígitos plausible y se acepta como buena. `maxNumberOfSymbols: 1` agravaba el
 * problema porque tomaba la primera que apareciera.
 *
 * Tres capas, en este orden:
 *   1. sólo simbologías con control de integridad (`RETAIL_BARCODE_FORMATS`),
 *   2. dígito verificador validado acá, sin confiar en el flag del lector,
 *   3. dos lecturas idénticas seguidas antes de disparar una búsqueda.
 */

/** Simbologías de mostrador que traen control de integridad propio. */
export const RETAIL_BARCODE_FORMATS = ["EAN13", "EAN8", "UPCA", "UPCE", "Code128"] as const;

export type RetailBarcodeFormat = (typeof RETAIL_BARCODE_FORMATS)[number];

/** Lo mínimo que necesitamos de un resultado del lector. */
export type BarcodeCandidate = { text: string; format: string };

const DIGITS_ONLY = /^\d+$/;

/**
 * Dígito verificador estándar GS1: sirve igual para EAN-8, UPC-A y EAN-13,
 * porque todos usan la misma alternancia 3-1 contada desde la derecha.
 */
export function eanCheckDigitValid(digits: string): boolean {
  if (!DIGITS_ONLY.test(digits) || digits.length < 2) return false;
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[body.length - 1 - index]);
    sum += index % 2 === 0 ? digit * 3 : digit;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(digits[digits.length - 1]);
}

function isRetailFormat(format: string): format is RetailBarcodeFormat {
  return (RETAIL_BARCODE_FORMATS as readonly string[]).includes(format);
}

/**
 * ¿Esta lectura es un código de producto confiable?
 * Devuelve `false` ante cualquier duda: es preferible un "no encontrado" visible
 * a vender el producto equivocado.
 */
export function isAcceptableBarcode({ text, format }: BarcodeCandidate): boolean {
  const code = text.trim();
  if (!code || !isRetailFormat(format)) return false;

  switch (format) {
    case "EAN13":
      return code.length === 13 && eanCheckDigitValid(code);
    case "UPCA":
      return code.length === 12 && eanCheckDigitValid(code);
    case "EAN8":
      return code.length === 8 && eanCheckDigitValid(code);
    case "UPCE":
      // 8 dígitos; el verificador de UPC-E exige expandirlo a UPC-A, y el lector
      // ya lo valida. Se acepta por longitud para no inventar una regla distinta.
      return code.length === 8 && DIGITS_ONLY.test(code);
    case "Code128":
      // Code128 trae MOD-103 obligatorio, que el lector ya verificó.
      return true;
    default:
      return false;
  }
}

/** Orden de preferencia cuando hay más de una lectura en el mismo frame. */
const FORMAT_PREFERENCE: Record<string, number> = {
  EAN13: 0,
  UPCA: 1,
  EAN8: 2,
  UPCE: 3,
  Code128: 4,
};

/** Primera lectura aceptable, prefiriendo las simbologías retail más específicas. */
export function selectBarcodeResult<T extends BarcodeCandidate>(results: readonly T[]): T | null {
  const acceptable = results.filter(isAcceptableBarcode);
  if (acceptable.length === 0) return null;
  return [...acceptable].sort(
    (left, right) => (FORMAT_PREFERENCE[left.format] ?? 99) - (FORMAT_PREFERENCE[right.format] ?? 99),
  )[0];
}

/**
 * Puerta de estabilidad: dispara recién cuando el mismo código se leyó
 * `required` veces seguidas. Una lectura mala no suele repetirse idéntica; un
 * código real sí, porque el operador mantiene la caja quieta.
 */
export function createStabilityGate(required = 2) {
  let last: string | null = null;
  let streak = 0;

  return {
    accept(rawCode: string): string | null {
      const code = rawCode.trim();
      if (code === last) streak += 1;
      else {
        last = code;
        streak = 1;
      }
      return streak >= required ? code : null;
    },
    reset(): void {
      last = null;
      streak = 0;
    },
  };
}
