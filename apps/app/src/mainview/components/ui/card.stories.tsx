import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, fn, userEvent } from "storybook/test";

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

const meta = {
  component: Card,
  title: "UI/Card",
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Connection")).toBeVisible();
    await expect(
      canvas.getByText("Configure your database connection.")
    ).toBeVisible();
    await expect(
      canvas.getByText("PostgreSQL on localhost:5432")
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Connect" })).toBeVisible();
  },
  render: () => (
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
  ),
};

export const Small: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Quick query")).toBeVisible();
    await expect(canvas.getByText("SELECT * FROM users")).toBeVisible();
  },
  render: () => (
    <Card className="w-72" size="sm">
      <CardHeader>
        <CardTitle>Quick query</CardTitle>
        <CardDescription>Run a one-off SQL statement.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">SELECT * FROM users</p>
      </CardContent>
    </Card>
  ),
};

export const WithAction: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Query history")).toBeVisible();
    const clearButton = canvas.getByRole("button", { name: "Clear" });
    await expect(clearButton).toBeVisible();
    await userEvent.click(clearButton);
  },
  render: () => {
    const onClear = fn();
    return (
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
  },
};
