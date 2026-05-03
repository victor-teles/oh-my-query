import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { KeysErrorState } from "./keys-error-state";

describe("keys-error-state", () => {
  it("renders the message and a retry button", async () => {
    const onRetry = vi.fn();
    const screen = render(
      <KeysErrorState message="ECONNRESET while scanning" onRetry={onRetry} />
    );

    expect(screen.getByText("Couldn't scan keyspace")).toBeInTheDocument();
    expect(screen.getByText("ECONNRESET while scanning")).toBeInTheDocument();

    await screen.getByRole("button", { name: /retry/i }).click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.container).toMatchSnapshot();
  });
});
