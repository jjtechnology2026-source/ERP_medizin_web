/**
 * Test-only ESM loader.
 *
 * Resolves the project `@/*` path alias (tsconfig `paths`) and extensionless
 * relative imports so `node --test` can import the real TypeScript sources.
 * It also redirects a few side-effectful modules to lightweight fixtures so the
 * store can be driven in-process without React, MQTT or axios.
 */
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(ROOT, "test", "fixtures");

/** Modules replaced by test fixtures for the products store seam. */
const REDIRECTS = new Map([
  ["@/modules/products/api/products.service", path.join(FIXTURES, "products-service-mock.mjs")],
  ["@/modules/products/types/products.types", path.join(FIXTURES, "products-types-mock.mjs")],
  ["@/modules/core/mqtt/advanced-service", path.join(FIXTURES, "mqtt-advanced-service-mock.mjs")],
]);

const EXTENSIONS = [
  "",
  ".ts",
  ".tsx",
  ".mjs",
  ".js",
  path.join("index.ts"),
  path.join("index.tsx"),
  path.join("index.mjs"),
  path.join("index.js"),
];

function resolveFile(base) {
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // keep trying
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (REDIRECTS.has(specifier)) {
    return { url: pathToFileURL(REDIRECTS.get(specifier)).href, shortCircuit: true };
  }

  let base = null;
  if (specifier.startsWith("@/")) {
    base = path.join(ROOT, specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parent = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : ROOT;
    base = path.resolve(parent, specifier);
  }

  if (base) {
    const file = resolveFile(base);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
