import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

describe("card", () => {
  it("default", async () => {
    const screen = render(
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>Configure your database connection.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            PostgreSQL on localhost:5432
          </p>
        </CardContent>
        <CardFooter>
          <Button size="sm">Connect</Button>
        </CardFooter>
      </Card>
    );
    await expect
      .element(screen.getByText("Connection", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Configure your database connection."))
      .toBeVisible();
    await expect
      .element(screen.getByText("PostgreSQL on localhost:5432"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Connect" }))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("small", async () => {
    const screen = render(
      <Card className="w-72" size="sm">
        <CardHeader>
          <CardTitle>Quick query</CardTitle>
          <CardDescription>Run a one-off SQL statement.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">SELECT * FROM users</p>
        </CardContent>
      </Card>
    );
    await expect.element(screen.getByText("Quick query")).toBeVisible();
    await expect.element(screen.getByText("SELECT * FROM users")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("withAction", async () => {
    const onClear = vi.fn();
    const screen = render(
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Query history</CardTitle>
          <CardDescription>Recent queries for this connection.</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">3 queries today</p>
        </CardContent>
      </Card>
    );
    await expect.element(screen.getByText("Query history")).toBeVisible();
    const clearButton = screen.getByRole("button", { name: "Clear" });
    await expect.element(clearButton).toBeVisible();
    await clearButton.click();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
