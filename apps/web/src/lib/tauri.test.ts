import { describe, expect, it } from "vitest";

import { isMacOS } from "@/lib/tauri";

const setUserAgent = (value: string): void => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    get: () => value,
  });
};

describe("isMacOS", () => {
  it("returns true for a desktop macOS user agent", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    );
    expect(isMacOS()).toBeTruthy();
  });

  it("returns false on iPhone even though the UA contains Mac OS X", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    expect(isMacOS()).toBeFalsy();
  });

  it("returns false on iPad", () => {
    setUserAgent(
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    expect(isMacOS()).toBeFalsy();
  });

  it("returns false on iPod", () => {
    setUserAgent(
      "Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1"
    );
    expect(isMacOS()).toBeFalsy();
  });

  it("returns false on Windows", () => {
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    expect(isMacOS()).toBeFalsy();
  });
});
