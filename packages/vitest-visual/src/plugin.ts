import type { Plugin } from "vite";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compareVisualSnapshot, updateVisualBaseline } from "./commands.ts";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const setupFile = join(pkgRoot, "src", "setup.ts");

export function visualRegression(): Plugin {
  return {
    config() {
      return {
        test: {
          browser: {
            commands: {
              compareVisualSnapshot,
              updateVisualBaseline,
            },
          },
          setupFiles: [setupFile],
        },
      };
    },

    name: "vitest-visual-regression",
  };
}
