import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";

const tables = [
  "users",
  "orders",
  "products",
  "categories",
  "reviews",
  "payments",
  "shipments",
  "addresses",
  "sessions",
  "logs",
  "notifications",
  "preferences",
];

describe("scroll-area", () => {
  it("default", async () => {
    const screen = render(
      <ScrollArea className="size-48 rounded-md border">
        <div className="p-3">
          <h4 className="mb-3 text-sm font-medium">Tables</h4>
          {tables.map((table) => (
            <div key={table}>
              <div className="py-1.5 text-xs">{table}</div>
              <Separator />
            </div>
          ))}
        </div>
      </ScrollArea>
    );
    await expect.element(screen.getByText("Tables")).toBeVisible();
    await expect.element(screen.getByText("users")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("horizontal", async () => {
    const screen = render(
      <ScrollArea className="w-72 rounded-md border">
        <div className="flex gap-3 p-3">
          {tables.map((table) => (
            <div
              className="
                flex h-16 w-24 shrink-0 items-center justify-center rounded-md
                border text-xs
              "
              key={table}
            >
              {table}
            </div>
          ))}
        </div>
      </ScrollArea>
    );
    await expect.element(screen.container).toMatchScreenshot();
  });
});
