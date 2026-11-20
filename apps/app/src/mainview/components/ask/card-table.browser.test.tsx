import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { CardTable, TABLE_ROW_LIMIT } from "./card-table";

const columns = [
  { name: "id", typeName: "INT4" },
  { name: "email", typeName: "TEXT" },
];

describe("cardTable", () => {
  it("caps rows and says how many were shown", async () => {
    const rows = Array.from({ length: 250 }, (_, i) => [i, `u${i}@x.io`]);
    const screen = render(
      <CardTable
        formats={{}}
        result={{ columns, isTruncated: true, rowCount: 2000, rows }}
      />
    );
    await expect
      .element(screen.getByText("Showing 200 of 2,000+"))
      .toBeVisible();
    expect(screen.getByRole("row").all()).toHaveLength(TABLE_ROW_LIMIT + 1);
  });

  it("right-aligns numbers, honors a column subset and omits the summary when complete", () => {
    const screen = render(
      <CardTable
        columns={["id"]}
        formats={{}}
        result={{
          columns,
          isTruncated: false,
          rowCount: 1,
          rows: [[7, "a@x.io"]],
        }}
      />
    );
    const header = screen.getByRole("columnheader", { name: "id" });
    expect(header.element().className).toContain("text-right");
    expect(
      screen.getByRole("columnheader", { name: "email" }).query()
    ).toBeNull();
    expect(screen.getByText(/Showing/).query()).toBeNull();
  });
});
