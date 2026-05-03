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

const isPrimary = (btn: Element) =>
  (btn.getAttribute("class") ?? "").includes("bg-primary");

describe("queryErrorDisplay primary action", () => {
  it("promotes Jump to line for syntax errors with a parseable location", () => {
    const screen = render(
      <QueryErrorDisplay
        error='syntax error at or near "FROMM" at line 3, column 7'
        errorCode="42601"
        onAiFix={vi.fn()}
        onJumpToLine={vi.fn()}
        onRetry={vi.fn()}
        sql="SELECT * FROMM users;"
      />
    );

    const jump = screen.getByRole("button", { name: /jump to/i }).element();
    const retry = screen.getByRole("button", { name: /^retry$/i }).element();
    const ai = screen.getByRole("button", { name: /fix with ai/i }).element();

    expect(isPrimary(jump)).toBeTruthy();
    expect(isPrimary(retry)).toBeFalsy();
    expect(isPrimary(ai)).toBeFalsy();
  });

  it("promotes Reconnect for connection errors", () => {
    const screen = render(
      <QueryErrorDisplay
        error="connection refused"
        errorCode="IO_ERROR"
        onReconnect={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const reconnect = screen
      .getByRole("button", { name: /reconnect/i })
      .element();
    const retry = screen.getByRole("button", { name: /^retry$/i }).element();

    expect(isPrimary(reconnect)).toBeTruthy();
    expect(isPrimary(retry)).toBeFalsy();
  });

  it("falls back to Retry as the primary action", () => {
    const screen = render(
      <QueryErrorDisplay
        error='relation "users" does not exist'
        errorCode="42P01"
        onAiFix={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const retry = screen.getByRole("button", { name: /^retry$/i }).element();
    const ai = screen.getByRole("button", { name: /fix with ai/i }).element();

    expect(isPrimary(retry)).toBeTruthy();
    expect(isPrimary(ai)).toBeFalsy();
  });

  it("shows exactly one primary-styled action button", () => {
    const screen = render(
      <QueryErrorDisplay
        error='syntax error at or near "FROMM" at line 3, column 7'
        errorCode="42601"
        onAiFix={vi.fn()}
        onJumpToLine={vi.fn()}
        onReconnect={vi.fn()}
        onRetry={vi.fn()}
        sql="SELECT * FROMM users;"
      />
    );

    const primaryButtons = [
      ...screen.container.querySelectorAll("button"),
    ].filter((btn) => isPrimary(btn));

    expect(primaryButtons).toHaveLength(1);
  });
});
