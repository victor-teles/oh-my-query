import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isFirstConnectionSeen,
  markFirstConnectionSeen,
} from "@/lib/first-connection";

const STORAGE_KEY = "om-q:first-connection-seen";

describe("first-connection flag", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reports unseen by default", () => {
    expect(isFirstConnectionSeen()).toBeFalsy();
  });

  it("flips to seen after marking", () => {
    markFirstConnectionSeen();
    expect(isFirstConnectionSeen()).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("treats arbitrary stored values as unseen", () => {
    localStorage.setItem(STORAGE_KEY, "false");
    expect(isFirstConnectionSeen()).toBeFalsy();
  });

  describe("without a window object", () => {
    let savedWindow: typeof globalThis.window | undefined;

    beforeEach(() => {
      savedWindow = globalThis.window;
      Reflect.deleteProperty(globalThis, "window");
    });

    afterEach(() => {
      if (savedWindow !== undefined) {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: savedWindow,
          writable: true,
        });
      }
    });

    it("returns true and is a no-op outside a browser env", () => {
      expect(isFirstConnectionSeen()).toBeTruthy();
      expect(() => markFirstConnectionSeen()).not.toThrow();
    });
  });
});
