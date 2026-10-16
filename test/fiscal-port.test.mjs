import test from "node:test";
import assert from "node:assert/strict";
import {
  canSavePort,
  resolveInitialPort,
  savePortBlockReason,
} from "../modules/settings/lib/fiscal-port.ts";

// Bug de caja (reportado): "Error al guardar la configuración fiscal: No se pudo
// comunicar con la impresora fiscal: could not open port 'COM99': FileNotFoundError(2, ...)".
// El selector arrancaba en el sentinel "99" y el servicio lo normalizaba a COM99 en
// Windows. Regla: el ERP nunca inventa un puerto; solo se guarda un device que vino
// de la lista del servicio.

const PORTS = [{ device: "COM5" }, { device: "COM7" }];

test("sin puerto guardado arranca vacío, nunca en el sentinel 99", () => {
  assert.equal(resolveInitialPort(null), "");
  assert.equal(resolveInitialPort(undefined), "");
  assert.equal(resolveInitialPort(""), "");
  assert.equal(resolveInitialPort("   "), "");
});

test("el puerto guardado en localStorage se respeta", () => {
  assert.equal(resolveInitialPort("COM5"), "COM5");
});

test("solo se puede guardar un puerto que vino de la lista del servicio", () => {
  assert.equal(canSavePort("COM5", PORTS), true);
  assert.equal(canSavePort("COM7", PORTS), true);
  assert.equal(canSavePort("99", PORTS), false);
  assert.equal(canSavePort("COM99", PORTS), false);
  assert.equal(canSavePort("", PORTS), false);
});

test("sin puertos detectados no se puede guardar y el motivo lo explica", () => {
  assert.equal(canSavePort("COM5", []), false);
  assert.match(String(savePortBlockReason("COM5", [])), /No hay puertos detectados/);
});

test("con puertos disponibles pero ninguno elegido, pide elegir uno", () => {
  assert.equal(canSavePort("", PORTS), false);
  assert.match(String(savePortBlockReason("", PORTS)), /Seleccioná un puerto/);
  assert.match(String(savePortBlockReason("COM99", PORTS)), /Seleccioná un puerto/);
});

test("puerto elegido: sin bloqueo ni motivo", () => {
  assert.equal(savePortBlockReason("COM5", PORTS), null);
});
