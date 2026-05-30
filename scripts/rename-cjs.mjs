// rename-cjs.mjs — Rename TS-emitted .js files in dist/cjs/ to .cjs so Node's
// ESM/CJS resolver picks the correct format. We can't set tsc's output
// extension directly, so we rename after compilation. Also rewrites internal
// `require('./foo')` to `require('./foo.cjs')` to match the renamed files.

import { readdirSync, statSync, renameSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CJS_DIR = join(HERE, "..", "dist", "cjs");

function walk(dir, fn) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, fn);
    else fn(full);
  }
}

// Step 1: rename .js → .cjs
const renamed = [];
walk(CJS_DIR, (file) => {
  if (file.endsWith(".js")) {
    const next = file.slice(0, -3) + ".cjs";
    renameSync(file, next);
    renamed.push(next);
  }
});

// Step 2: rewrite require("./foo") and require("./foo.js") → require("./foo.cjs")
//
// tsc emits the import path verbatim. Our source uses `./audit-stream.js`
// (mandatory for ESM module resolution under tsconfig moduleResolution=Bundler
// + NodeNext-style imports). CJS compilation preserves that `.js` suffix in
// require(). We strip it before re-adding `.cjs` so the path points at the
// renamed file.
const requireRe = /require\(\s*(["'])(\.\.?\/[^"']+)\1\s*\)/g;
for (const file of renamed) {
  const before = readFileSync(file, "utf8");
  const after = before.replace(requireRe, (match, quote, spec) => {
    if (spec.endsWith(".cjs") || spec.endsWith(".json")) return match;
    const stripped = spec.endsWith(".js") ? spec.slice(0, -3) : spec;
    return `require(${quote}${stripped}.cjs${quote})`;
  });
  if (after !== before) writeFileSync(file, after);
}

console.log(`renamed ${renamed.length} .js → .cjs and rewrote require() specifiers`);
