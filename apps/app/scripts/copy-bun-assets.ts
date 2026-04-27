import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const corePackageDir = path.join(appDir, "..", "..", "packages", "core");

const polyglotEntry = Bun.resolveSync("@polyglot-sql/sdk", corePackageDir);
const polyglotWasm = path.join(
  path.dirname(polyglotEntry),
  "polyglot_sql_wasm_bg.wasm"
);

const destDir = path.join(appDir, "assets", "bun");
const destFile = path.join(destDir, "polyglot_sql_wasm_bg.wasm");

mkdirSync(destDir, { recursive: true });
copyFileSync(polyglotWasm, destFile);

console.log(
  `copied ${path.relative(appDir, polyglotWasm)} → ${path.relative(appDir, destFile)}`
);
