export type IpcHandler = (payload: Record<string, unknown>) => unknown;

export const ipcHandlerRegistry: Record<string, IpcHandler> = {};

export const resetIpcHandlers = (): void => {
  for (const key of Object.keys(ipcHandlerRegistry)) {
    // oxlint-disable-next-line typescript/no-dynamic-delete
    delete ipcHandlerRegistry[key];
  }
};
