import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildZRegisterPayload } from "../modules/cash-register/lib/fiscal-fallback-flow.ts";
import { recordLastZPrint, readLastZPrint } from "../modules/cash-register/lib/fiscal-fallback.ts";

// S4: imprimir el reporte Z y registrarlo en el libro de ventas son dos
// operaciones distintas. Imprimir nunca registra; registrar nunca imprime.

const memStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
};

const identity = (over = {}) => ({
  pharmacyId: "pharm-1",
  zNumber: 42,
  fiscalSerial: "ABC123",
  via: "fiscal",
  printedAt: "2026-11-14T10:00:00.000Z",
  ...over,
});

test("registrar manda solo la identidad fiscal, nunca las facturas", () => {
  const payload = buildZRegisterPayload({ zNumber: 42, fiscalSerial: "ABC123" });
  assert.deepEqual(payload, { z_number: 42, fiscal_serial: "ABC123" });
  assert.equal("invoices" in payload, false, "el registro no puede reenviar el rango de facturas");
});

test("registrar sin identidad capturada no inventa numeros", () => {
  assert.deepEqual(buildZRegisterPayload(), {});
  assert.deepEqual(buildZRegisterPayload(null), {});
  assert.deepEqual(buildZRegisterPayload({}), {});
  assert.deepEqual(buildZRegisterPayload({ zNumber: 0, fiscalSerial: "  " }), {});
  assert.deepEqual(buildZRegisterPayload({ zNumber: Number.NaN, fiscalSerial: "" }), {});
});

test("la identidad del ultimo print se guarda por farmacia y gana la ultima", () => {
  const storage = memStorage();
  recordLastZPrint(identity({ zNumber: 1 }), storage);
  recordLastZPrint(identity({ pharmacyId: "pharm-2", zNumber: 9 }), storage);
  recordLastZPrint(identity({ zNumber: 7 }), storage);

  assert.equal(readLastZPrint("pharm-1", storage)?.zNumber, 7, "gana el ultimo print de esa farmacia");
  assert.equal(readLastZPrint("pharm-2", storage)?.zNumber, 9);
  assert.equal(readLastZPrint("pharm-3", storage), null, "no se filtra la identidad de otra farmacia");
});

test("sin storage o con basura no explota y devuelve null", () => {
  assert.equal(readLastZPrint("pharm-1", memStorage()), null);
  assert.equal(readLastZPrint("", memStorage()), null);
  const corrupt = { getItem: () => "{no es json", setItem: () => {} };
  assert.equal(readLastZPrint("pharm-1", corrupt), null);
});

// El componente y la tarjeta no son ejecutables en node --test (JSX), asi que el
// contrato de "dos operaciones" se pinnea por fuente, igual que en pricing.test.mjs.
test("el dialogo Z no usa la ruta acoplada que imprime y registra de una", () => {
  const src = readFileSync(
    new URL("../modules/cash-register/components/ZReportDialog.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /runZReportFallback/, "la ruta que imprime y registra de una ya no debe usarse");
  assert.doesNotMatch(src, /persistFallbackZ/, "el dialogo no debe persistir el Z al imprimir");
  assert.doesNotMatch(src, /registrarAutomatico/, "imprimir no puede encadenar el registro");
  assert.match(src, /printZReportFallback/, "el modo imprimir usa la ruta de solo impresion");
});

test("la tarjeta abre las dos operaciones por separado", () => {
  const src = readFileSync(
    new URL("../modules/settings/components/FiscalConfigCard.tsx", import.meta.url),
    "utf8",
  );
  // Cada modo se pide desde su propio click: dos pedidos distintos, no uno solo
  // que decida adentro.
  assert.match(src, /requestZReport\("print"\)/, "falta el pedido del modo imprimir");
  assert.match(src, /requestZReport\("register"\)/, "falta el pedido del modo registrar");
  assert.match(src, /<ZReportDialog mode=/, "el dialogo debe recibir el modo explicito");
});

// El aviso de "ya hay un Z hoy" no puede vivir adentro del dialogo del Z: ese
// dialogo arranca solo al montarse, asi que la verificacion corre antes de
// abrirlo y el boton ya no lo abre de forma directa.
test("el aviso de Z duplicado corre antes de abrir el dialogo del Z", () => {
  const src = readFileSync(
    new URL("../modules/settings/components/FiscalConfigCard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /resolveZReportDayGuard/, "falta la verificacion del dia antes de abrir");
  assert.match(src, /<ZReportDayWarningDialog/, "falta el modal de aviso");
  assert.match(src, /listZReportsByDate/, "la verificacion debe consultar el libro del dia");
  assert.doesNotMatch(
    src,
    /onClick=\{\(\) => setShowZReport\(/,
    "ningun boton puede saltarse la verificacion abriendo el dialogo directo",
  );
});
