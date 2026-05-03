import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { KeysEmptyState } from "./keys-empty-state";

describe("keys-empty-state — empty-db", () => {
  it("renders starter button when onRunStarter is provided", async () => {
    const onRunStarter = vi.fn();
    const screen = render(
      <KeysEmptyState onRunStarter={onRunStarter} variant="empty-db" />
    );

    expect(screen.getByText("This DB is empty")).toBeInTheDocument();
    await screen.getByRole("button", { name: /run set hello world/i }).click();
    expect(onRunStarter).toHaveBeenCalledOnce();
    expect(screen.container).toMatchSnapshot();
  });

  it("hides the starter button when onRunStarter is omitted", () => {
    const screen = render(<KeysEmptyState variant="empty-db" />);

    expect(screen.getByText("This DB is empty")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /run set hello world/i }).query()
    ).toBeNull();
  });
});

describe("keys-empty-state — no-match", () => {
  it("renders the searched pattern in a code block", () => {
    const screen = render(
      <KeysEmptyState pattern="user:*" variant="no-match" />
    );

    expect(screen.getByText("No keys match")).toBeInTheDocument();
    expect(screen.getByText("user:*")).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });
});
