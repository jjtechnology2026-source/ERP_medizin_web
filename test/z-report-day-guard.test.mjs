import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateZReportDayGuard,
  pickMachineSerial,
  resolveZReportDayGuard,
  usableMachineSerial,
} from "../modules/cash-register/lib/z-report-day-guard.ts";

// S1-S6: un solo reporte Z por dia y por maquina fiscal. El duplicado real
// ocurre entre personas distintas, asi que la verificacion consulta el libro
// del dia (backend) y no el navegador.

const PHARM = "pharm-1";
const HOY = "2026-11-14";
const SERIAL = "Z1F1234567";

const report = (over = {}) => ({
  zNumber: 42,
  fiscalSerial: SERIAL,
  fiscalDate: HOY,
  ...over,
});

const input = (over = {}) => ({
  fetchOk: true,
  reports: [],
  machineSerial: SERIAL,
  pharmacyId: PHARM,
  fiscalDate: HOY,
  preferSerial: true,
  ...over,
});

test("S1: sin Z del dia no hay aviso", () => {
  const r = evaluateZReportDayGuard(input());

  assert.equal(r.status, "none");
  assert.equal(r.scope, "serial");
  assert.equal(r.match, null);
  assert.equal(r.matchedBy, "none");
  assert.equal(r.todayCount, 0);
  assert.equal(r.note, null);
});

test("S2: mismo serial de maquina, con otro formato, dispara el aviso", () => {
  const r = evaluateZReportDayGuard(
    input({ reports: [report({ fiscalSerial: " z1f-1234567 " })] }),
  );

  assert.equal(r.status, "duplicate");
  assert.equal(r.scope, "serial");
  assert.equal(r.matchedBy, "serial");
  assert.equal(r.match?.zNumber, 42);
  assert.equal(r.todayCount, 1);
  assert.equal(r.note, null);
});

test("S3: un Z de OTRA maquina fiscal no frena esta caja", () => {
  const r = evaluateZReportDayGuard(input({ reports: [report({ fiscalSerial: "Z9X9999999" })] }));

  assert.equal(r.status, "none");
  assert.equal(r.match, null);
  assert.equal(r.todayCount, 1, "el Z de la otra maquina existe, pero no es de esta");
});

test("S4: sin serial legible degrada a farmacia y avisa igual", () => {
  const r = evaluateZReportDayGuard(
    input({ reports: [report({ fiscalSerial: "Z9X9999999" })], machineSerial: null }),
  );

  assert.equal(r.status, "duplicate");
  assert.equal(r.scope, "pharmacy");
  assert.equal(r.matchedBy, "pharmacy");
  assert.match(String(r.note), /serial/i);
  assert.equal(r.machineSerial, null);
});

test("S5: un Z que salio por la POS80 cierra el dia aunque el serial no coincida", () => {
  const r = evaluateZReportDayGuard(
    input({ reports: [report({ zNumber: 1930, fiscalSerial: `${PHARM}-${HOY}-1930` })] }),
  );

  assert.equal(r.status, "duplicate");
  assert.equal(r.matchedBy, "fallback");
  assert.equal(r.match?.zNumber, 1930);
});

test("S6: el Z de ayer no cuenta para hoy", () => {
  const r = evaluateZReportDayGuard(
    input({ reports: [report({ fiscalDate: "2026-11-13" })] }),
  );

  assert.equal(r.status, "none");
  assert.equal(r.todayCount, 0);
});

test("S7: si la consulta falla el estado es unverified, nunca none", () => {
  const r = evaluateZReportDayGuard(
    input({ fetchOk: false, reports: [report()] }),
  );

  assert.equal(r.status, "unverified");
  assert.equal(r.match, null);
  assert.match(String(r.note), /verificar/i);
});

test("S8: con facturacion digital se compara por farmacia aunque haya serial", () => {
  const r = evaluateZReportDayGuard(
    input({ preferSerial: false, reports: [report({ fiscalSerial: "Z9X9999999" })] }),
  );

  assert.equal(r.status, "duplicate");
  assert.equal(r.scope, "pharmacy");
  assert.equal(r.matchedBy, "pharmacy");
});

test("S9: pickMachineSerial ignora vacios y normaliza", () => {
  assert.equal(pickMachineSerial([null, "  ", " z1f 1234567 "]), "Z1F1234567");
  assert.equal(pickMachineSerial([null, undefined, ""]), null);
});

test("S12: el serial sintetico de un Z de POS80 no se toma como serial de maquina", () => {
  // Si se tomara, la comparacion por serial no encontraria el Z del dia y el
  // aviso desapareceria justo cuando el dia ya esta cerrado.
  assert.equal(usableMachineSerial(`${PHARM}-${HOY}-1930`, PHARM), null);
  assert.equal(usableMachineSerial(SERIAL, PHARM), SERIAL);
  assert.equal(usableMachineSerial(null, PHARM), null);
});

test("S10: la orquestacion degrada a farmacia si la impresora no responde", async () => {
  const r = await resolveZReportDayGuard({
    pharmacyId: PHARM,
    fiscalDate: HOY,
    preferSerial: true,
    readMachineSerial: () => {
      throw new Error("printer offline");
    },
    fetchToday: async () => ({ ok: true, reports: [report()] }),
  });

  assert.equal(r.status, "duplicate");
  assert.equal(r.scope, "pharmacy");
});

test("S11: la orquestacion reporta unverified si el listado del dia lanza", async () => {
  const r = await resolveZReportDayGuard({
    pharmacyId: PHARM,
    fiscalDate: HOY,
    preferSerial: true,
    readMachineSerial: () => SERIAL,
    fetchToday: async () => {
      throw new Error("network down");
    },
  });

  assert.equal(r.status, "unverified");
  assert.equal(r.machineSerial, "Z1F1234567");
});
