import type { Plugin } from "vite";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compareVisualSnapshot, updateVisualBaseline } from "./commands.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const setupFile = join(dir, "setup.ts");

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
