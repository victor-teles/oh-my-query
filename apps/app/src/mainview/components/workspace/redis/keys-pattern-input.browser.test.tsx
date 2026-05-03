import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { KeysPatternInput } from "./keys-pattern-input";

describe("keys-pattern-input", () => {
  it("emits onChange as the user types", async () => {
    const onChange = vi.fn();
    const screen = render(<KeysPatternInput onChange={onChange} />);

    await screen.getByPlaceholder(/scan match/i).fill("user:*");

    expect(onChange).toHaveBeenLastCalledWith("user:*");
  });

  it("renders the initial value", () => {
    const screen = render(
      <KeysPatternInput initialValue="prefix:*" onChange={vi.fn()} />
    );

    expect(screen.getByPlaceholder(/scan match/i).element()).toHaveValue(
      "prefix:*"
    );
    expect(
      screen.getByRole("button", { name: /clear pattern/i })
    ).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });

  it("clears the value via the clear button", async () => {
    const onChange = vi.fn();
    const screen = render(
      <KeysPatternInput initialValue="abc" onChange={onChange} />
    );

    await screen.getByRole("button", { name: /clear pattern/i }).click();

    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByPlaceholder(/scan match/i).element()).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /clear pattern/i }).query()
    ).toBeNull();
  });
});
