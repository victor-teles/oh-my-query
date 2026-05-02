import { DatabaseIcon, InboxIcon, SearchIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Button } from "./button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty";

describe("empty", () => {
  it("default", async () => {
    const screen = render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>No results</EmptyTitle>
          <EmptyDescription>
            Your query returned no rows. Try adjusting the filters.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
    await expect.element(screen.getByText("No results")).toBeVisible();
    await expect
      .element(
        screen.getByText(
          "Your query returned no rows. Try adjusting the filters."
        )
      )
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("withAction", async () => {
    const screen = render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <DatabaseIcon />
          </EmptyMedia>
          <EmptyTitle>No connections</EmptyTitle>
          <EmptyDescription>
            Get started by adding your first database connection.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm">Add Connection</Button>
        </EmptyContent>
      </Empty>
    );
    await expect.element(screen.getByText("No connections")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Add Connection" }))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("searchEmpty", async () => {
    const screen = render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <SearchIcon className="size-10 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>No matches found</EmptyTitle>
          <EmptyDescription>
            Try a different search term or clear the filter.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
    await expect.element(screen.getByText("No matches found")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
