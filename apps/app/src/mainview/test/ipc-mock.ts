import type { IpcHandler } from "./ipc-handler-registry";

import {
  ipcHandlerRegistry,
  ipcMessageHandlers,
  resetIpcHandlers,
} from "./ipc-handler-registry";

export type CommandHandlers = Record<string, IpcHandler>;

// Handler keys match the bun-side RPC request names (e.g. `getServerVersion`).
export const mockIpc = (handlers: CommandHandlers): void => {
  resetIpcHandlers();
  Object.assign(ipcHandlerRegistry, handlers);
};

// Delivers a bun → renderer message through the real `@/lib/ipc` handlers.
export const emitIpcMessage = (name: string, payload: unknown = {}): void => {
  const handler = ipcMessageHandlers.current[name];
  if (!handler) {
    throw new Error(`No renderer handler registered for message ${name}`);
  }
  handler(payload);
};
