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
    expect(page.getByText("MySQL")).toBeInTheDocument();
    expect(page.getByRole("listbox").element()).toMatchSnapshot();
  });

  it("withLabel", () => {
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
    expect(screen.getByText("Database Type")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
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
    expect(page.getByText("SQL", { exact: true })).toBeInTheDocument();
    await expect(page.getByText("NoSQL", { exact: true })).toBeInTheDocument();
    expect(page.getByRole("listbox").element()).toMatchSnapshot();
  });

  it("small", () => {
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
    expect(screen.getByRole("combobox")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });
});
