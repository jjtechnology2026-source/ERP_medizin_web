import test from "node:test";
import assert from "node:assert/strict";
import { mustReleaseStream } from "./stream-abandonment.ts";

test("carrera ya resuelta: el stream que llega tarde se apaga aunque la sesion siga viva", () => {
  // El caso que dejo la camara prendida: permiso aceptado a los 25s, con el
  // timeout de 20s ya disparado y la MISMA sesion de start().
  assert.equal(mustReleaseStream({ settled: true, session: 3, currentSession: 3 }), true);
});

test("la sesion avanzo: el stream se apaga aunque la carrera no haya resuelto", () => {
  // stop(), unmount o un segundo start() mientras se abria la camara.
  assert.equal(mustReleaseStream({ settled: false, session: 3, currentSession: 4 }), true);
});

test("camino feliz: carrera abierta y misma sesion, el stream se usa", () => {
  assert.equal(mustReleaseStream({ settled: false, session: 3, currentSession: 3 }), false);
});

test("las dos condiciones juntas no cambian el veredicto", () => {
  assert.equal(mustReleaseStream({ settled: true, session: 3, currentSession: 4 }), true);
});
