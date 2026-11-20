import { describe, expect, it } from "vitest";

describe("web test harness", () => {
  it("runs in a jsdom environment", () => {
    localStorage.clear();
    localStorage.setItem("conch", "ready");

    expect(localStorage.getItem("conch")).toBe("ready");
  });
});
