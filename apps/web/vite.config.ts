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
    coverage: {
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        "src/test/**",
        "src/routeTree.gen.ts",
        "src/**/types.ts",
        "src/components/ui/**",
        "src/components/ai-elements/**",
        "src/components/titlebar/**",
        "src/components/command-palette/**",
        "src/components/workspace/chat/**",
        "src/components/workspace/workspace-content.tsx",
        "src/components/workspace/workspace-layout.tsx",
        "src/components/workspace/workspace-sidebar.tsx",
        "src/components/workspace/workspace-providers.tsx",
        "src/components/workspace/explain-panel/explain-panel.tsx",
        "src/components/workspace/results-grid/**",
        "src/routes/**",
        "src/main.tsx",
      ],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      thresholds: {
        branches: 35,
        functions: 40,
        lines: 40,
        statements: 40,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          environment: "jsdom",
          exclude: ["e2e/**", "node_modules/**", "dist/**"],
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
            "@tauri-apps/plugin-opener",
            "@uiw/codemirror-theme-github",
            "@uiw/codemirror-themes-all",
            "@uiw/react-codemirror",
            "ai",
            "date-fns",
            "nanoid",
            "streamdown",
            "use-stick-to-bottom",
            "zustand",
            "zustand/react/shallow",
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
