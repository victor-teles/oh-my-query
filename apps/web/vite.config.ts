/// <reference types="vitest/config" />

import { visualRegression } from "@oh-my-query/vitest-visual";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [tailwindcss(), tanstackRouter({}), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3001,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        extends: true,
        optimizeDeps: {
          entries: ["src/**/*.stories.@(ts|tsx)", ".storybook/preview.ts"],
          include: [
            "@ai-sdk/anthropic",
            "@ai-sdk/openai",
            "@base-ui/react/popover",
            "@codemirror/lang-sql",
            "@codemirror/language",
            "@codemirror/state",
            "@codemirror/view",
            "@streamdown/cjk",
            "@streamdown/code",
            "@streamdown/math",
            "@streamdown/mermaid",
            "@tanstack/react-router",
            "@tanstack/react-table",
            "@tanstack/react-virtual",
            "@tauri-apps/api/core",
            "@tauri-apps/api/event",
            "@tauri-apps/api/window",
            "@uiw/codemirror-theme-github",
            "@uiw/codemirror-themes-all",
            "@uiw/react-codemirror",
            "ai",
            "date-fns",
            "nanoid",
            "streamdown",
            "use-stick-to-bottom",
            "zustand",
          ],
        },
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
          visualRegression(),
        ],
        test: {
          browser: {
            enabled: true,
            headless: true,
            instances: [
              {
                browser: "chromium",
                launch: {
                  args: [
                    "--font-render-hinting=none",
                    "--disable-skia-runtime-opts",
                    "--disable-font-subpixel-positioning",
                    "--disable-lcd-text",
                  ],
                },
              },
            ],
            provider: "playwright",
            screenshotFailures: false,
          },
          name: "storybook",
          retry: 2,
        },
      },
    ],
  },
});
