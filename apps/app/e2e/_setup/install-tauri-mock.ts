import type { Page } from "@playwright/test";

export type CommandHandler = (
  payload: Record<string, unknown>
) => unknown | Promise<unknown>;
export type CommandHandlers = Record<string, CommandHandler>;

const BRIDGE_NAME = "__omqInvokeBridge__";

/**
 * Install a Tauri IPC stub on the page before navigation. Mirrors the semantics
 * of `mockIPC()` from `@tauri-apps/api/mocks` but runs across the
 * Node↔browser boundary.
 *
 * Handlers are kept on the Node side and exposed to the page via
 * `page.exposeFunction`. The init script wires `window.__TAURI_INTERNALS__.invoke`
 * to call back into Node, so handler closures (which structured-clone cannot
 * serialize) stay where they were defined.
 *
 * Note: only the IPC surface is shimmed — events and webview APIs are not.
 * Add support here when an e2e flow needs them.
 */
export const installTauriMock = async (
  page: Page,
  handlers: CommandHandlers
): Promise<void> => {
  await page.exposeFunction(
    BRIDGE_NAME,
    async (cmd: string, payload: Record<string, unknown>) => {
      const handler = handlers[cmd];
      if (!handler) {
        throw new Error(`Unmocked Tauri command: ${cmd}`);
      }
      return await handler(payload ?? {});
    }
  );

  await page.addInitScript((bridgeName) => {
    type Bridge = (
      cmd: string,
      payload: Record<string, unknown>
    ) => Promise<unknown>;
    const bridge = (window as unknown as Record<string, Bridge>)[bridgeName];
    const internals = {
      invoke: (cmd: string, payload?: Record<string, unknown>) =>
        bridge(cmd, payload ?? {}),
      transformCallback: (callback: (value: unknown) => void) => {
        const id = Math.floor(Math.random() * 2 ** 31);
        (window as unknown as Record<string, unknown>)[`_${id}`] = callback;
        return id;
      },
    };
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ =
      internals;
  }, BRIDGE_NAME);
};
