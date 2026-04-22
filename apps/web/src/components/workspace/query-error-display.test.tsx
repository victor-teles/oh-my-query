import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryErrorDisplay } from "./query-error-display";

const isPrimary = (btn: HTMLElement) => btn.className.includes("bg-primary");

describe("queryErrorDisplay", () => {
  it("promotes Jump to line for syntax errors with a parseable location", () => {
    render(
      <QueryErrorDisplay
        error='syntax error at or near "FROMM" at line 3, column 7'
        errorCode="42601"
        onAiFix={vi.fn()}
        onJumpToLine={vi.fn()}
        onRetry={vi.fn()}
        sql="SELECT * FROMM users;"
      />
    );

    const jump = screen.getByRole("button", { name: /jump to/i });
    const retry = screen.getByRole("button", { name: /^retry$/i });
    const ai = screen.getByRole("button", { name: /fix with ai/i });

    expect(isPrimary(jump)).toBeTruthy();
    expect(isPrimary(retry)).toBeFalsy();
    expect(isPrimary(ai)).toBeFalsy();
  });

  it("promotes Reconnect for connection errors", () => {
    render(
      <QueryErrorDisplay
        error="connection refused"
        errorCode="IO_ERROR"
        onReconnect={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const reconnect = screen.getByRole("button", { name: /reconnect/i });
    const retry = screen.getByRole("button", { name: /^retry$/i });

    expect(isPrimary(reconnect)).toBeTruthy();
    expect(isPrimary(retry)).toBeFalsy();
  });

  it("falls back to Retry as the primary action", () => {
    render(
      <QueryErrorDisplay
        error='relation "users" does not exist'
        errorCode="42P01"
        onAiFix={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const retry = screen.getByRole("button", { name: /^retry$/i });
    const ai = screen.getByRole("button", { name: /fix with ai/i });

    expect(isPrimary(retry)).toBeTruthy();
    expect(isPrimary(ai)).toBeFalsy();
  });

  it("shows exactly one primary-styled action button", () => {
    render(
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

    const primaryButtons = screen
      .getAllByRole("button")
      .filter((btn) => isPrimary(btn));

    expect(primaryButtons).toHaveLength(1);
  });
});
