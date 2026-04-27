import type { IpcHandler } from "./ipc-handler-registry";

import { ipcHandlerRegistry, resetIpcHandlers } from "./ipc-handler-registry";

export type CommandHandlers = Record<string, IpcHandler>;

export interface MockTauriOptions {
  shouldMockEvents?: boolean;
}

// Registers handlers for the renderer-side Electroview RPC client. Tests pass
// camelCase command names matching the bun-side handler keys (e.g.
// `getServerVersion`, `connectToDatabase`). Each call resets prior handlers.
export const mockTauri = (
  handlers: CommandHandlers,
  _options?: MockTauriOptions
): void => {
  resetIpcHandlers();
  Object.assign(ipcHandlerRegistry, handlers);
};

export const mockIpc = mockTauri;
