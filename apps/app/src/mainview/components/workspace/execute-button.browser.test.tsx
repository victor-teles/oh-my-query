import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ExecuteButton } from "./execute-button";

describe("execute-button", () => {
  it("invokes onClick when enabled and idle", async () => {
    const onClick = vi.fn();
    const screen = render(
      <ExecuteButton disabled={false} isRunning={false} onClick={onClick} />
    );
    const btn = screen.getByRole("button");
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled while running", () => {
    const screen = render(
      <ExecuteButton disabled={false} isRunning onClick={vi.fn()} />
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when explicitly disabled", () => {
    const screen = render(
      <ExecuteButton disabled isRunning={false} onClick={vi.fn()} />
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
