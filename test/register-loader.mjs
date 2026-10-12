/** Preloaded via `node --import` so `node --test` uses the alias loader. */
import { register } from "node:module";

register("./alias-loader.mjs", import.meta.url);
