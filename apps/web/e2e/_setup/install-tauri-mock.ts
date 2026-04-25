import type { Page } from "@playwright/test";

export type CommandHandler = (
  payload: Record<string, unknown>
) => unknown | Promise<unknown>;
export type CommandHandlers = Record<string, CommandHandler>;

/**
 * Install a Tauri IPC stub on the page before navigation. Mirrors the semantics
 * of `mockIPC()` from `@tauri-apps/api/mocks` but lives in the page context so
 * Playwright can drive flows that the app gates behind `isTauri()`.
 *
 * Note: only the IPC surface is shimmed — events and webview APIs are not.
 * Add support here when an e2e flow needs them.
 */
export const installTauriMock = async (
  page: Page,
  handlers: CommandHandlers
): Promise<void> => {
  await page.addInitScript(
    (commands) => {
      const internals = {
        invoke: (cmd: string, payload?: Record<string, unknown>) => {
          const handler = (commands as Record<string, CommandHandler>)[cmd];
          if (!handler) {
            return Promise.reject(new Error(`Unmocked Tauri command: ${cmd}`));
          }
          return Promise.resolve(handler(payload ?? {}));
        },
        transformCallback: (callback: (value: unknown) => void) => {
          const id = Math.floor(Math.random() * 2 ** 31);
          const win = window as unknown as Record<string, unknown>;
          win[`_${id}`] = callback;
          return id;
        },
      };
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ =
        internals;
    },
    handlers as unknown as Record<string, unknown>
  );
};
