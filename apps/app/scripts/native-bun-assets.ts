import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_DIR = path.dirname(
  path.dirname(fileURLToPath(import.meta.url))
);
export const ASSETS_BUN_DIR = path.join(APP_DIR, "assets", "bun");

const PACKAGES_DIR = path.join(APP_DIR, "..", "..", "packages");

export interface NativeBunAsset {
  readonly fileName: string;
  readonly resolveSource: () => string;
}

export interface NativeBunModule {
  readonly id: string;
  readonly assets: readonly NativeBunAsset[];
  readonly externals: readonly string[];
}

const polyglotSqlModule: NativeBunModule = {
  id: "polyglot-sql",
  assets: [
    {
      fileName: "polyglot_sql_wasm_bg.wasm",
      resolveSource: () => {
        const corePackageDir = path.join(PACKAGES_DIR, "core");
        const entry = Bun.resolveSync("@polyglot-sql/sdk", corePackageDir);
        return path.join(path.dirname(entry), "polyglot_sql_wasm_bg.wasm");
      },
    },
  ],
  externals: [],
};

const DUCKDB_PLATFORMS = [
  "linux-x64",
  "linux-arm64",
  "darwin-arm64",
  "darwin-x64",
  "win32-x64",
] as const;

const duckdbDylibName = (platform: NodeJS.Platform): string => {
  switch (platform) {
    case "win32":
      return "duckdb.dll";
    case "darwin":
      return "libduckdb.dylib";
    default:
      return "libduckdb.so";
  }
};

const duckdbPlatformId = `${process.platform}-${process.arch}`;

const duckdbModule: NativeBunModule = {
  id: "duckdb",
  assets: [
    {
      fileName: duckdbDylibName(process.platform),
      resolveSource: () => {
        const driverPackageDir = path.join(PACKAGES_DIR, "drivers-duckdb");
        const apiEntry = Bun.resolveSync("@duckdb/node-api", driverPackageDir);
        const bindingsShim = Bun.resolveSync(
          "@duckdb/node-bindings",
          path.dirname(apiEntry)
        );
        const bindingDir = path.join(
          path.dirname(bindingsShim),
          "..",
          `node-bindings-${duckdbPlatformId}`
        );
        return path.join(bindingDir, duckdbDylibName(process.platform));
      },
    },
  ],
  externals: DUCKDB_PLATFORMS.filter((p) => p !== duckdbPlatformId).map(
    (p) => `@duckdb/node-bindings-${p}/duckdb.node`
  ),
};

export const nativeBunModules: readonly NativeBunModule[] = [
  polyglotSqlModule,
  duckdbModule,
];
