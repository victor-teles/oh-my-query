import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { AskErrorCode } from "@/lib/ipc";

import { AskError, offendingKeyword } from "./ask-error";

const failure = (code: AskErrorCode, message = "detail") => ({
  code,
  message,
  phase: "sql" as const,
});

describe("askError", () => {
  it.each<[AskErrorCode, string, string, "retry" | "settings"]>([
    [
      "NO_AI_SETTINGS",
      "Add an AI provider to ask questions.",
      "Open Settings",
      "settings",
    ],
    [
      "AI_AUTH",
      "The AI provider rejected the key or model.",
      "Open Settings",
      "settings",
    ],
    ["QUERY_FAILED", "The query failed.", "Retry", "retry"],
    ["AI_NETWORK", "The AI provider could not be reached.", "Retry", "retry"],
    [
      "AI_RATE_LIMIT",
      "The AI provider is limiting requests. Try again in a moment.",
      "Retry",
      "retry",
    ],
    ["TIMEOUT", "The query took longer than 30 seconds.", "Retry", "retry"],
    [
      "INVALID_SPEC",
      "The answer could not be shaped into a card.",
      "Retry",
      "retry",
    ],
  ])(
    "explains %s and offers one next step",
    async (code, title, label, action) => {
      const onAction = vi.fn();
      const screen = render(
        <AskError
          source="question"
          failure={failure(code)}
          onAction={onAction}
        />
      );
      await expect.element(screen.getByRole("alert")).toHaveTextContent(title);
      await screen.getByRole("button", { name: label }).click();
      expect(onAction).toHaveBeenCalledWith(action);
    }
  );

  it.each<[AskErrorCode, string]>([
    [
      "UNSUPPORTED_ENGINE",
      "Asking questions works with SQL databases for now.",
    ],
    [
      "NOT_READ_ONLY",
      "This would change data. oh-my-query only runs read-only questions.",
    ],
  ])("explains %s with no action", async (code, title) => {
    const screen = render(
      <AskError source="question" failure={failure(code)} onAction={vi.fn()} />
    );
    await expect.element(screen.getByRole("alert")).toHaveTextContent(title);
    expect(screen.getByRole("button").query()).toBeNull();
  });

  it("finds the keyword a read-only refusal names", () => {
    expect(
      offendingKeyword(
        failure(
          "NOT_READ_ONLY",
          "Only read-only queries can run here, not DELETE."
        )
      )
    ).toBe("DELETE");
    expect(
      offendingKeyword(
        failure("NOT_READ_ONLY", "INTO is not allowed in a read-only query.")
      )
    ).toBe("INTO");
    expect(offendingKeyword(failure("QUERY_FAILED", "DELETE"))).toBeNull();
  });
});
