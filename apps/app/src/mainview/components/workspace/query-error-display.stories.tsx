import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, fn, userEvent } from "storybook/test";

import { QueryErrorDisplay } from "./query-error-display";

const meta = {
  args: {
    error: 'syntax error at or near "FROM"',
    onAiFix: fn(),
    onJumpToLine: fn(),
    onReconnect: fn(),
    onRetry: fn(),
  },
  component: QueryErrorDisplay,
  title: "Workspace/QueryErrorDisplay",
} satisfies Meta<typeof QueryErrorDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SyntaxError: Story = {
  args: {
    error:
      'LINE 1: SELCT * FROM users\n        ^\nsyntax error at or near "SELCT"',
    errorCode: "42601",
    sql: "SELCT * FROM users",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Syntax")).toBeVisible();
    await expect(canvas.getByRole("button", { name: /retry/i })).toBeVisible();
  },
};

export const ConnectionError: Story = {
  args: {
    error: "could not connect to database: connection refused",
    errorCode: "IO_ERROR",
    sql: "SELECT 1",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Connection")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /reconnect/i })
    ).toBeVisible();
  },
};

export const ConstraintError: Story = {
  args: {
    error: "duplicate key value violates unique constraint",
    errorCode: "23505",
    sql: "INSERT INTO users (id) VALUES (1)",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Constraint")).toBeVisible();
    await expect(canvas.getByText("23505")).toBeVisible();
  },
};

export const RetryFires: Story = {
  args: {
    error: "permission denied for table users",
    errorCode: "42501",
  },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /retry/i }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
