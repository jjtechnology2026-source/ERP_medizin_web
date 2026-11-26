#!/usr/bin/env node
/**
 * Copies the fiscal service installer from the `service_fiscal` repo into
 * `public/` so the ERP serves the same script the service repo maintains.
 *
 * Why this exists: the file lives in two repositories and was copied by hand.
 * By 2026-11 it had drifted four months behind, and the copy the ERP was
 * serving could not register its scheduled tasks at all (it passed the bare
 * `$env:USERNAME` to `-UserId`, where a task principal needs the qualified
 * `EQUIPO\usuario`). A pharmacy that installed from that button ended up with
 * no "Medizin Fiscal Service" task and therefore no updater either.
 *
 * The source of truth is `install_fiscal_service.ps1` in the service repo; the
 * name differs here only because the public URL uses hyphens.
 *
 * Deployments that clone this repo alone (Docker/Railway) have no sibling
 * directory: there the committed copy is what ships, so a missing source is a
 * skip with a warning, never a failed build.
 */
import { copyFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SOURCE = resolve(process.cwd(), "..", "service_fiscal", "install_fiscal_service.ps1");
const TARGET = resolve(process.cwd(), "public", "install-fiscal-service.ps1");

if (!existsSync(SOURCE)) {
  console.warn(
    `[sync:fiscal-installer] no sibling checkout at ${SOURCE} — keeping the committed copy of ${TARGET}`,
  );
  process.exit(0);
}

copyFileSync(SOURCE, TARGET);

const before = readFileSync(TARGET, "utf8");
const identityFix = before.includes("$identity.Name") && !/UserId \$env:USERNAME/.test(before);

console.log(
  `[sync:fiscal-installer] ${SOURCE} -> ${TARGET} (${statSync(TARGET).size} bytes)` +
    (identityFix ? "" : " — WARNING: the source no longer uses $identity.Name for the task principal"),
);
