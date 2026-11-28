// Deriva del modo de facturación a partir de lo que el backend ACABA de emitir.
//
// El POS lee `modoFacturacion` en el login y el refresh del JWT reutiliza esa
// foto: una sesión abierta conserva el modo viejo indefinidamente. Si una
// farmacia pasa a `simple` mientras alguien está logueado, el POS seguiría
// creyendo que emite por máquina fiscal o por el backend.
//
// El backend, en cambio, decide por la fila de la farmacia y devuelve el control
// que emitió. Ese control es la evidencia más fresca que existe: si empieza con
// `SIMPLE-`, la farmacia está en modo `simple`, diga lo que diga la sesión.

import type { ModoFacturacion } from "@/modules/auth/api/auth.services";

/** Prefijo del número de control que el backend usa solo en modo `simple`. */
export const SIMPLE_CONTROL_PREFIX = "SIMPLE-";

/**
 * Modo que hay que adoptar, o `null` si la sesión ya estaba en lo correcto.
 *
 * Solo corrige hacia `simple`: es el único caso en que seguir con el modo viejo
 * tiene consecuencias (imprimiría un comprobante fiscal que el backend no va a
 * registrar). En los demás no hay evidencia suficiente para corregir a ciegas.
 */
export function detectBillingModeDrift(
  sessionMode: ModoFacturacion | undefined,
  control: string | null | undefined,
): "simple" | null {
  const emitted = String(control ?? "").trim().toUpperCase();
  if (!emitted.startsWith(SIMPLE_CONTROL_PREFIX)) return null;
  return sessionMode === "simple" ? null : "simple";
}
