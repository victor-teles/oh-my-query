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

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({
      routesDirectory: path.resolve(dirname, "./src/mainview/routes"),
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src/mainview"),
    },
  },
  server: {
    port: 3001,
    strictPort: true,
  },
  test: {
    coverage: {
      exclude: [
        "src/mainview/**/*.test.{ts,tsx}",
        "src/mainview/**/*.stories.{ts,tsx}",
        "src/mainview/test/**",
        "src/mainview/routeTree.gen.ts",
        "src/mainview/**/types.ts",
        "src/mainview/components/ui/**",
        "src/mainview/components/ai-elements/**",
        "src/mainview/components/titlebar/**",
        "src/mainview/components/command-palette/**",
        "src/mainview/components/workspace/chat/**",
        "src/mainview/components/workspace/workspace-content.tsx",
        "src/mainview/components/workspace/workspace-layout.tsx",
        "src/mainview/components/workspace/workspace-sidebar.tsx",
        "src/mainview/components/workspace/workspace-providers.tsx",
        "src/mainview/components/workspace/explain-panel/explain-panel.tsx",
        "src/mainview/components/workspace/results-grid/**",
        "src/mainview/routes/**",
        "src/mainview/main.tsx",
      ],
      include: ["src/mainview/**/*.{ts,tsx}"],
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
          setupFiles: ["./src/mainview/test/setup.ts"],
        },
      },
      {
        extends: true,
        optimizeDeps: {
          entries: [
            "src/mainview/**/*.stories.@(ts|tsx)",
            ".storybook/preview.ts",
          ],
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
          storybookTest({ configDir: path.join(dirname, ".storybook") }),
          visualRegression(),
        ],
        test: {
          browser: {
            enabled: true,
            headless: true,
            instances: [
              {
                browser: "chromium",
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
