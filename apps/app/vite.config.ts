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
    entries: ["index.html"],
    include: [
      "@tanstack/react-router",
      "react-dom/client",
      "motion/react",
      "lucide-react",
      "next-themes",
    ],
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({
      generatedRouteTree: path.resolve(
        dirname,
        "./src/mainview/routeTree.gen.ts"
      ),
      routesDirectory: path.resolve(dirname, "./src/mainview/routes"),
    }),
    react(),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(dirname, "./src/mainview") },
      {
        find: /^electrobun\/view$/,
        replacement: path.resolve(
          dirname,
          "./.hutch/devkit/api/browser/index.ts"
        ),
      },
    ],
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
    // Animated browser tests oversubscribe Chromium past ~4 parallel files and
    // Playwright then sees springs as never-stable; 4 matches the CI runners.
    maxWorkers: 4,
    projects: [
      {
        extends: true,
        test: {
          environment: "jsdom",
          exclude: [
            "e2e/**",
            "node_modules/**",
            "dist/**",
            "build/**",
            ".hutch/**",
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
