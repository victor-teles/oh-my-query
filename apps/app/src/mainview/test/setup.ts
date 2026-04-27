import type * as ElectrobunView from "electrobun/view";

import { afterEach, vi } from "vitest";

import { ipcHandlerRegistry, resetIpcHandlers } from "./ipc-handler-registry";

const noopStub = () => {
  /* no-op */
};

const dispatchToRegistry =
  (method: string) =>
  (payload?: Record<string, unknown>): Promise<unknown> => {
    const handler = ipcHandlerRegistry[method];
    if (!handler) {
      return Promise.reject(
        new Error(
          `Unexpected RPC command: ${method}. Register it via mockTauri()/mockIpc().`
        )
      );
    }
    return Promise.resolve(handler(payload ?? {}));
  };

vi.mock<typeof ElectrobunView>(import("electrobun/view"), () => {
  class Electroview {
    rpc = {
      request: new Proxy({} as Record<string, unknown>, {
        get: (_target, prop: string) => dispatchToRegistry(prop),
      }),
      send: new Proxy({} as Record<string, unknown>, {
        get: () => noopStub,
      }),
    };
    static defineRPC<T>(config: T): T {
      return config;
    }
  }
  return { Electroview } as unknown as typeof ElectrobunView;
});

// oxlint-disable-next-line jest/require-top-level-describe, jest/no-hooks
afterEach(() => {
  resetIpcHandlers();
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
});
