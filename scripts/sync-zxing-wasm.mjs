#!/usr/bin/env node
/**
 * Copies the `zxing-wasm` reader binary into `public/zxing/` so the scanner
 * screen serves it from the same origin instead of downloading it from the
 * jsDelivr CDN on first read.
 *
 * Why this exists: the app runs on a pharmacy counter with unstable signal
 * (spec S6 of `odd/tasks/barcode-scan-price.md`). A third-party CDN in the
 * critical path of "scan a barcode" is the exact failure mode we cannot afford.
 *
 * Run it after any `zxing-wasm` version bump: the JS glue and the `.wasm`
 * binary must come from the same build, or the module fails at runtime.
 *
 *   node scripts/sync-zxing-wasm.mjs
 */
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";

const SOURCE = "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm";
const TARGET = "public/zxing/zxing_reader.wasm";

const version = JSON.parse(
  readFileSync("node_modules/zxing-wasm/package.json", "utf8"),
).version;

mkdirSync(dirname(TARGET), { recursive: true });
copyFileSync(SOURCE, TARGET);

const { size } = statSync(TARGET);
console.log(`zxing-wasm ${version} reader -> ${TARGET} (${size} bytes)`);
