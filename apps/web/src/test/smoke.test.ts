import { describe, expect, it } from "vitest";

describe("web test harness", () => {
  it("runs in a jsdom environment", () => {
    localStorage.setItem("oh-my-query", "ready");

    expect(localStorage.getItem("oh-my-query")).toBe("ready");
  });
});
