/**
 * Reglas del puerto fiscal de la caja.
 *
 * El selector de la configuración fiscal manda al servicio fiscal el `device` de
 * un puerto que el propio servicio enumera. Cuando el valor no viene de esa lista
 * (el sentinel histórico "99", un `localStorage` de otra PC, un COM de un emulador)
 * el servicio intenta abrir un puerto que no existe: en Windows lo normaliza a
 * `COM99` y responde 503 con el traceback crudo de pyserial, que el operador ve
 * como "Error al guardar la configuración fiscal: No se pudo comunicar con la
 * impresora fiscal: could not open port 'COM99': FileNotFoundError...".
 *
 * Viven acá, fuera del componente, para poder probarlas sin DOM.
 */

export interface FiscalPortOption {
  device: string;
}

/**
 * Puerto inicial del selector a partir de lo persistido en `localStorage`.
 *
 * Nunca inventa un puerto: sin valor guardado se arranca vacío, para que el
 * operador elija uno de la lista real o use "Detectar impresora".
 */
export function resolveInitialPort(stored: string | null | undefined): string {
  return (stored ?? "").trim();
}

/** True solo si el puerto es uno de los que enumeró el servicio fiscal. */
export function canSavePort(port: string, ports: FiscalPortOption[]): boolean {
  return ports.some((option) => option.device === port);
}

/**
 * Motivo visible de por qué todavía no se puede guardar, o `null` si sí se puede.
 */
export function savePortBlockReason(port: string, ports: FiscalPortOption[]): string | null {
  if (canSavePort(port, ports)) return null;
  if (ports.length === 0) {
    return "No hay puertos detectados: verificá que la máquina fiscal esté encendida y conectada, o usá \"Detectar impresora\".";
  }
  return "Seleccioná un puerto de la lista antes de guardar.";
}
