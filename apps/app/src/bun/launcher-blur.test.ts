import { describe, expect, it } from "vitest";

import { blurResponse } from "./launcher-blur";

describe("blurResponse", () => {
  it("ignores a blur while hidden", () => {
    expect(
      blurResponse({ modal: false, rendererReady: true, visible: false })
    ).toBe("ignore");
  });

  it("ignores a blur while a system panel is open", () => {
    expect(
      blurResponse({ modal: true, rendererReady: true, visible: true })
    ).toBe("ignore");
  });

  it("asks the renderer to dismiss once it is listening", () => {
    expect(
      blurResponse({ modal: false, rendererReady: true, visible: true })
    ).toBe("dismiss");
  });

  it("hides the window directly before the renderer is ready", () => {
    expect(
      blurResponse({ modal: false, rendererReady: false, visible: true })
    ).toBe("hide");
  });
});
