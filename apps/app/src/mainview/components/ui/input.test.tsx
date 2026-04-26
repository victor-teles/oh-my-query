import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

function getInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("input");
  if (!input) {
    throw new Error("input not rendered");
  }
  return input;
}

describe("input", () => {
  it("disables browser autofill and spellcheck by default", () => {
    const { container } = render(<Input />);
    const input = getInput(container);
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
  });

  it("hides itself from password managers by default", () => {
    const { container } = render(<Input />);
    const input = getInput(container);
    expect(input.dataset["1pIgnore"]).toBe("true");
    expect(input.dataset.lpignore).toBe("true");
    expect(input.dataset.formType).toBe("other");
  });

  it("lets consumers override the autocomplete attribute", () => {
    const { container } = render(<Input autoComplete="username" />);
    expect(getInput(container).getAttribute("autocomplete")).toBe("username");
  });

  it("lets consumers re-enable spellcheck", () => {
    const { container } = render(<Input spellCheck />);
    expect(getInput(container).getAttribute("spellcheck")).toBe("true");
  });
});
