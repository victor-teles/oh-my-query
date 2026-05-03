import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { SqlCodeBlock } from "./sql-code-block";

vi.mock(import("./highlighted-sql"), () => ({
  HighlightedSql: ({ code }: { code: string }) => (
    <pre data-testid="hl-sql">{code}</pre>
  ),
}));

describe("sql-code-block", () => {
  it("renders the code via the syntax-highlighted block", () => {
    const screen = render(<SqlCodeBlock code="SELECT 1" />);

    expect(screen.getByTestId("hl-sql").element().textContent).toBe("SELECT 1");
    expect(screen.getByText("SQL")).toBeInTheDocument();
  });

  it("only shows Copy when no callbacks are provided", () => {
    const screen = render(<SqlCodeBlock code="SELECT 1" />);

    expect(
      screen.getByRole("button", { name: /copy sql/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /run query/i }).query()
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /insert to editor/i }).query()
    ).toBeNull();
  });

  it("calls onInsert with the code when Insert is clicked", async () => {
    const onInsert = vi.fn();
    const screen = render(<SqlCodeBlock code="SELECT 2" onInsert={onInsert} />);

    await screen.getByRole("button", { name: /insert to editor/i }).click();
    expect(onInsert).toHaveBeenCalledExactlyOnceWith("SELECT 2");
  });

  it("hides Replace unless hasSelection is true", () => {
    const onReplace = vi.fn();
    const screen = render(
      <SqlCodeBlock code="SELECT 1" onReplace={onReplace} />
    );

    expect(
      screen.getByRole("button", { name: /replace selection/i }).query()
    ).toBeNull();
  });

  it("calls onReplace when Replace is clicked", async () => {
    const onReplace = vi.fn();
    const screen = render(
      <SqlCodeBlock code="SELECT 3" hasSelection onReplace={onReplace} />
    );

    await screen.getByRole("button", { name: /replace selection/i }).click();
    expect(onReplace).toHaveBeenCalledExactlyOnceWith("SELECT 3");
  });

  it("calls onRun when Run is clicked", async () => {
    const onRun = vi.fn();
    const screen = render(<SqlCodeBlock code="SELECT 4" onRun={onRun} />);

    await screen.getByRole("button", { name: /run query/i }).click();
    expect(onRun).toHaveBeenCalledExactlyOnceWith("SELECT 4");
  });

  it("writes the code to clipboard on Copy and confirms via aria-label", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();

    try {
      const screen = render(<SqlCodeBlock code="SELECT 5" />);
      await screen.getByRole("button", { name: /copy sql/i }).click();

      expect(writeText).toHaveBeenCalledExactlyOnceWith("SELECT 5");
      await expect
        .element(screen.getByRole("button", { name: /^copied$/i }))
        .toBeInTheDocument();
    } finally {
      writeText.mockRestore();
    }
  });
});
