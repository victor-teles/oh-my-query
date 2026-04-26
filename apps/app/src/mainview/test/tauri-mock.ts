import { vi } from "vitest";

type Handler = (payload: Record<string, unknown>) => unknown;
export type CommandHandlers = Record<string, Handler>;

export interface MockTauriOptions {
  shouldMockEvents?: boolean;
}

// Renderer tests stub `@/lib/ipc` directly. This helper installs a mocked
// version of the IPC client where each RPC method dispatches to a handler
// keyed by its (camelCase) command name — matching the legacy mockIPC API.
export const mockTauri = (
  handlers: CommandHandlers,
  _options?: MockTauriOptions
): void => {
  const mock = new Proxy(
    {},
    {
      get: (_, prop: string) => (payload?: Record<string, unknown>) => {
        const handler = handlers[prop];
        if (!handler) {
          throw new Error(`Unexpected RPC command: ${prop}`);
        }
        return Promise.resolve(
          handler((payload ?? {}) as Record<string, unknown>)
        );
      },
    }
  );

  vi.doMock(import("@/lib/ipc"), () => ({
    ...mock,
    ENGINE_SUPPORTS_ANALYZE: {},
    ENGINE_SUPPORTS_EXPLAIN: {},
    isMacOS: () => false,
    onMenuNavigate: noopSubscribe,
    onUpdateProgress: noopSubscribe,
  }));
};

const noopUnsub = (): void => {
  /* no-op unsubscribe */
};
const noopSubscribe = () => noopUnsub;
