import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { RedisDbChip } from "./redis-db-chip";

describe("redis-db-chip", () => {
  it("renders the active DB index and pluralized key count", () => {
    const screen = render(
      <RedisDbChip dbIndex={3} onSelect={vi.fn()} totalKeys={42} />
    );

    expect(screen.getByText("db3")).toBeInTheDocument();
    expect(screen.getByText(/· 42 keys/)).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });

  it("renders the singular form for one key", () => {
    const screen = render(
      <RedisDbChip dbIndex={0} onSelect={vi.fn()} totalKeys={1} />
    );

    expect(screen.getByText(/· 1 key$/)).toBeInTheDocument();
  });

  it("renders an ellipsis when totalKeys is null", () => {
    const screen = render(
      <RedisDbChip dbIndex={0} onSelect={vi.fn()} totalKeys={null} />
    );

    expect(screen.getByText(/· …/)).toBeInTheDocument();
  });

  it("calls onSelect with the parsed numeric DB index", async () => {
    const onSelect = vi.fn();
    const screen = render(
      <RedisDbChip dbIndex={0} onSelect={onSelect} totalKeys={0} />
    );

    await screen.getByRole("combobox").click();
    await screen.getByRole("option", { name: "db5" }).click();

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(5);
  });
});
