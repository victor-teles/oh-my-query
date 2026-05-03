import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { KeysStatusFooter } from "./keys-status-footer";

describe("keys-status-footer", () => {
  it("shows the loading message and hides load-more while scanning", () => {
    const screen = render(
      <KeysStatusFooter
        isLoading
        nextCursor="123"
        onLoadMore={vi.fn()}
        shown={2500}
        total={null}
      />
    );

    expect(screen.getByText(/scanning/i)).toBeInTheDocument();
    expect(screen.getByText(/2,500/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /load more/i }).query()
    ).toBeNull();
    expect(screen.container).toMatchSnapshot();
  });

  it("renders the totals when not loading", () => {
    const screen = render(
      <KeysStatusFooter
        isLoading={false}
        nextCursor="0"
        onLoadMore={vi.fn()}
        shown={42}
        total={42}
      />
    );

    expect(screen.getByText(/Showing 42 of 42/)).toBeInTheDocument();
  });

  it("renders Load more when there is a next cursor", async () => {
    const onLoadMore = vi.fn();
    const screen = render(
      <KeysStatusFooter
        isLoading={false}
        nextCursor="100"
        onLoadMore={onLoadMore}
        shown={50}
        total={null}
      />
    );

    await screen.getByRole("button", { name: /load more/i }).click();
    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
