import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Textarea } from "./textarea";

describe("textarea", () => {
  it("applies desktop-friendly defaults", () => {
    const { container } = render(<Textarea />);
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.getAttribute("autocomplete")).toBe("off");
    expect(textarea?.getAttribute("autocorrect")).toBe("off");
    expect(textarea?.getAttribute("autocapitalize")).toBe("off");
    expect(textarea?.getAttribute("spellcheck")).toBe("false");
  });

  it("lets consumers re-enable spellcheck for prose fields", () => {
    const { container } = render(<Textarea spellCheck />);
    const textarea = container.querySelector("textarea");
    expect(textarea?.getAttribute("spellcheck")).toBe("true");
  });
});
