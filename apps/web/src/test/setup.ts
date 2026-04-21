/* eslint-disable jest/no-hooks, jest/require-top-level-describe */
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach } from "vitest";

afterEach(() => {
  clearMocks();
  if ("__TAURI_INTERNALS__" in window) {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  }
  localStorage.clear();
});
