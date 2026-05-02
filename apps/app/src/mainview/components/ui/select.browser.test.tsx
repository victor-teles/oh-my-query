import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

describe("select", () => {
  it("default", async () => {
    const screen = render(
      <Select defaultValue="postgres">
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select database" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="postgres">PostgreSQL</SelectItem>
          <SelectItem value="mysql">MySQL</SelectItem>
          <SelectItem value="sqlite">SQLite</SelectItem>
          <SelectItem value="mongo">MongoDB</SelectItem>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByRole("combobox");
    await trigger.click();
    await expect.element(page.getByText("MySQL")).toBeInTheDocument();
    await expect.element(page.getByRole("listbox")).toMatchScreenshot();
  });

  it("withLabel", async () => {
    const screen = render(
      <div className="grid gap-1.5">
        <Label>Database Type</Label>
        <Select>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="postgres">PostgreSQL</SelectItem>
            <SelectItem value="mysql">MySQL</SelectItem>
            <SelectItem value="sqlite">SQLite</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
    await expect.element(screen.getByText("Database Type")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("withGroups", async () => {
    const screen = render(
      <Select>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Select database..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>SQL</SelectLabel>
            <SelectItem value="postgres">PostgreSQL</SelectItem>
            <SelectItem value="mysql">MySQL</SelectItem>
            <SelectItem value="sqlite">SQLite</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>NoSQL</SelectLabel>
            <SelectItem value="mongo">MongoDB</SelectItem>
            <SelectItem value="redis">Redis</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    await screen.getByRole("combobox").click();
    await expect
      .element(page.getByText("SQL", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("NoSQL", { exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("listbox")).toMatchScreenshot();
  });

  it("small", async () => {
    const screen = render(
      <Select defaultValue="50">
        <SelectTrigger size="sm" className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10 rows</SelectItem>
          <SelectItem value="25">25 rows</SelectItem>
          <SelectItem value="50">50 rows</SelectItem>
          <SelectItem value="100">100 rows</SelectItem>
        </SelectContent>
      </Select>
    );
    await expect.element(screen.getByRole("combobox")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
