import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { QueryErrorDisplay } from "./query-error-display";

describe("query-error-display", () => {
  it("syntaxError", async () => {
    const onAiFix = vi.fn();
    const onJumpToLine = vi.fn();
    const onReconnect = vi.fn();
    const onRetry = vi.fn();
    const screen = render(
      <QueryErrorDisplay
        error={
          'LINE 1: SELCT * FROM users\n        ^\nsyntax error at or near "SELCT"'
        }
        errorCode="42601"
        onAiFix={onAiFix}
        onJumpToLine={onJumpToLine}
        onReconnect={onReconnect}
        onRetry={onRetry}
        sql="SELCT * FROM users"
      />
    );
    expect(screen.getByText("Syntax", { exact: true })).toBeVisible();
    await expect(screen.getByRole("button", { name: /retry/i })).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("connectionError", async () => {
    const onAiFix = vi.fn();
    const onJumpToLine = vi.fn();
    const onReconnect = vi.fn();
    const onRetry = vi.fn();
    const screen = render(
      <QueryErrorDisplay
        error="could not connect to database: connection refused"
        errorCode="IO_ERROR"
        onAiFix={onAiFix}
        onJumpToLine={onJumpToLine}
        onReconnect={onReconnect}
        onRetry={onRetry}
        sql="SELECT 1"
      />
    );
    expect(screen.getByText("Connection", { exact: true })).toBeVisible();
    await expect(
      screen.getByRole("button", { name: /reconnect/i })
    ).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("constraintError", async () => {
    const onAiFix = vi.fn();
    const onJumpToLine = vi.fn();
    const onReconnect = vi.fn();
    const onRetry = vi.fn();
    const screen = render(
      <QueryErrorDisplay
        error="duplicate key value violates unique constraint"
        errorCode="23505"
        onAiFix={onAiFix}
        onJumpToLine={onJumpToLine}
        onReconnect={onReconnect}
        onRetry={onRetry}
        sql="INSERT INTO users (id) VALUES (1)"
      />
    );
    expect(screen.getByText("Constraint", { exact: true })).toBeVisible();
    await expect(screen.getByText("23505")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("retryFires", async () => {
    const onAiFix = vi.fn();
    const onJumpToLine = vi.fn();
    const onReconnect = vi.fn();
    const onRetry = vi.fn();
    const screen = render(
      <QueryErrorDisplay
        error="permission denied for table users"
        errorCode="42501"
        onAiFix={onAiFix}
        onJumpToLine={onJumpToLine}
        onReconnect={onReconnect}
        onRetry={onRetry}
      />
    );
    await screen.getByRole("button", { name: /retry/i }).click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.container).toMatchSnapshot();
  });
});
