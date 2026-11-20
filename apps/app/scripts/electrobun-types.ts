import { existsSync, rmSync } from "node:fs";
import path from "node:path";

import { APP_DIR } from "./native-bun-assets.ts";

const TSCONFIG = path.join(APP_DIR, "tsconfig.electrobun.json");
const TYPES_DIR = path.join(APP_DIR, ".hutch/types");
const DEVKIT_API = path.join(APP_DIR, ".hutch/devkit/api");
const DEVKIT_ENTRY = path.join(DEVKIT_API, "sdks/main/index.ts");
const EXPECTED_DECLARATIONS = [
  ".hutch/types/sdks/main/index.d.ts",
  ".hutch/types/browser/index.d.ts",
];
// TS4000–TS4125 are declaration-emit "cannot be named" diagnostics: the devkit
// references unexported helper types, which TypeScript still emits structurally.
const DECLARATION_NAMING_CODES = { max: 4125, min: 4000 };
const DIAGNOSTIC = /^(?<file>[^(]+)\(\d+,\d+\): error TS(?<code>\d+):/;

const isToleratedDiagnostic = (line: string): boolean => {
  const match = DIAGNOSTIC.exec(line);
  if (!match?.groups) {
    return false;
  }
  const file = path.resolve(APP_DIR, match.groups.file ?? "");
  const code = Number(match.groups.code);
  return (
    file.startsWith(`${DEVKIT_API}${path.sep}`) &&
    code >= DECLARATION_NAMING_CODES.min &&
    code <= DECLARATION_NAMING_CODES.max
  );
};

const emitDeclarations = (): string[] => {
  const result = Bun.spawnSync(["bunx", "tsgo", "-p", TSCONFIG], {
    cwd: APP_DIR,
    stderr: "pipe",
    stdout: "pipe",
  });
  const output = `${result.stdout.toString()}${result.stderr.toString()}`;
  const diagnostics = output
    .split("\n")
    .filter((line) => line.includes("error TS"));
  if (result.exitCode !== 0 && diagnostics.length === 0) {
    return [output.trim() || `tsgo exited with code ${result.exitCode}`];
  }
  return diagnostics.filter((line) => !isToleratedDiagnostic(line));
};

if (!existsSync(DEVKIT_ENTRY)) {
  console.error(
    "[electrobun-types] devkit missing: run `bunx electrobun sync` in apps/app first"
  );
  process.exit(1);
}

rmSync(TYPES_DIR, { force: true, recursive: true });
const unexpected = emitDeclarations();
const missing = EXPECTED_DECLARATIONS.filter(
  (file) => !existsSync(path.join(APP_DIR, file))
);

if (unexpected.length > 0 || missing.length > 0) {
  for (const line of unexpected) {
    console.error(`[electrobun-types] ${line}`);
  }
  for (const file of missing) {
    console.error(`[electrobun-types] not emitted: ${file}`);
  }
  process.exit(1);
}

console.log("[electrobun-types] declarations ready in .hutch/types");
