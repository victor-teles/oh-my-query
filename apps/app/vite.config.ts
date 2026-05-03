/// <reference types="vitest/config" />

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  optimizeDeps: {
    include: [
      "@tanstack/react-router",
      "@tanstack/react-table",
      "@tanstack/react-virtual",
      "react-dom/client",
      "zustand",
      "zustand/react/shallow",
      "@codemirror/lang-sql",
      "@codemirror/language",
      "@codemirror/state",
      "@codemirror/view",
      "@uiw/react-codemirror",
      "@uiw/codemirror-themes-all",
      "@uiw/codemirror-theme-github",
      "date-fns",
      "ai",
      "@ai-sdk/anthropic",
      "@ai-sdk/google",
      "@ai-sdk/openai",
      "use-stick-to-bottom",
      "nanoid",
      "streamdown",
      "@streamdown/cjk",
      "@streamdown/code",
      "@streamdown/math",
      "@streamdown/mermaid",
    ],
  },
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
        "src/mainview/**/*.browser.test.tsx",
        "src/mainview/test/**",
        "src/mainview/routeTree.gen.ts",
        "src/mainview/**/types.ts",
        "src/mainview/routes/**",
        "src/mainview/main.tsx",
      ],
      include: ["src/mainview/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
    projects: [
      {
        extends: true,
        test: {
          environment: "jsdom",
          exclude: [
            "e2e/**",
            "node_modules/**",
            "dist/**",
            "**/*.browser.test.tsx",
          ],
          globals: true,
          name: "unit",
          setupFiles: ["./src/mainview/test/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium" }],
            provider: playwright(),
            screenshotFailures: false,
          },
          include: ["src/**/*.browser.test.tsx"],
          name: "browser",
          setupFiles: ["./src/mainview/test/setup-browser.ts"],
        },
      },
    ],
  },
});
