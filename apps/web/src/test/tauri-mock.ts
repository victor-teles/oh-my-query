import { mockIPC } from "@tauri-apps/api/mocks";

type Handler = (payload: Record<string, unknown>) => unknown;
export type CommandHandlers = Record<string, Handler>;

export interface MockTauriOptions {
  shouldMockEvents?: boolean;
}

export const mockTauri = (
  handlers: CommandHandlers,
  options?: MockTauriOptions
): void => {
  mockIPC((cmd, payload) => {
    const handler = handlers[cmd];
    if (!handler) {
      throw new Error(`Unexpected Tauri command: ${cmd}`);
    }
    return handler((payload ?? {}) as Record<string, unknown>);
  }, options);
};
