import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { SqlBlock } from "./sql-block";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const SQL = "-- Revenue\nselect region, sum(mrr)\nfrom revenue";

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("sqlBlock with %s", (_label, isReduced) => {
  it("numbers each line and shows a caret only while streaming", async () => {
    reduced.value = isReduced;
    const screen = render(<SqlBlock sql={SQL} state="streaming" />);
    const region = screen.getByRole("region", { name: "Generated SQL" });

    await expect.element(region).toHaveTextContent("1-- Revenue");
    await expect.element(region).toHaveTextContent("3from revenue");
    const caret = screen.getByTestId("sql-caret");
    await expect.element(caret).toBeInTheDocument();
    expect(caret.element().classList.contains("ask-caret")).toBe(!isReduced);

    await screen.rerender(<SqlBlock sql={SQL} state="settled" />);
    expect(screen.getByTestId("sql-caret").query()).toBeNull();
  });
});

describe("sqlBlock", () => {
  it("underlines the offending keyword and dims stopped SQL", () => {
    const screen = render(
      <SqlBlock mark="delete" sql="delete from users" state="stopped" />
    );
    const keyword = screen.getByText("delete");
    expect(keyword.element().className).toContain("underline");
    expect(
      (screen.getByRole("region").element() as HTMLElement).dataset.state
    ).toBe("stopped");
  });

  it("highlights keywords, strings and numbers", () => {
    const screen = render(
      <SqlBlock sql="select 'paid', 42 from t" state="settled" />
    );
    expect(screen.getByText("select").element().className).toContain(
      "text-chart-1"
    );
    expect(screen.getByText("'paid'").element().className).toContain(
      "text-chart-5"
    );
    expect(screen.getByText("42").element().className).toContain(
      "text-chart-2"
    );
  });

  it("stays pinned to the newest line while streaming", async () => {
    const long = Array.from({ length: 40 }, (_, i) => `select ${i}`).join("\n");
    const screen = render(<SqlBlock sql={long} state="streaming" />);
    const element = screen.getByRole("region").element();
    await expect
      .poll(() => element.scrollTop + element.clientHeight)
      .toBeGreaterThanOrEqual(element.scrollHeight - 1);
  });
});

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("sqlBlock change marks with %s", (_label, isReduced) => {
  it("marks only the changed lines and settles them fully drawn", async () => {
    reduced.value = isReduced;
    const screen = render(
      <SqlBlock changed={new Set([1, 2])} sql={SQL} state="settled" />
    );
    const marks = screen.getByTestId("sql-change-mark");
    await expect.poll(() => marks.elements()).toHaveLength(2);
    await expect
      .poll(() => marks.elements().map((mark) => mark.style.transform))
      .toStrictEqual(["none", "none"]);
  });
});
