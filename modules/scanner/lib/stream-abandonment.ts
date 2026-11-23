/**
 * ¿Hay que apagar un MediaStream que acaba de llegar?
 *
 * Existe por un defecto concreto que sobrevivió a dos rondas de revisión: cuando
 * el permiso de cámara se responde **después** del timeout de `start()`, la
 * carrera ya rechazó y nadie guarda el stream. Comparar sólo la sesión no
 * alcanza, porque el timeout **no** mueve la sesión: hay que mirar también si la
 * carrera ya se resolvió. Si es así, el stream es huérfano y sus tracks tienen
 * que apagarse en el acto o la luz de la cámara queda encendida con la UI en
 * error (spec S6 de `odd/tasks/barcode-scan-price.md`).
 *
 * Vive en su propio módulo, sin imports, para poder testearlo sin DOM ni React.
 */
export type StreamAbandonment = {
  /** La carrera de `start()` ya se resolvió (ganó el stream o ganó el timeout). */
  settled: boolean;
  /** Sesión que pidió la cámara. */
  session: number;
  /** Sesión vigente en el momento en que el stream llega. */
  currentSession: number;
};

export function mustReleaseStream({
  settled,
  session,
  currentSession,
}: StreamAbandonment): boolean {
  return settled || session !== currentSession;
}
