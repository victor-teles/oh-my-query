// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { Meta, StoryObj } from "@storybook/react-vite";

import { toast } from "sonner";
import { expect, userEvent, within } from "storybook/test";

import { ThemeProvider } from "@/components/theme-provider";

import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = {
  component: Toaster,
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" attribute="class">
        <Story />
        <Toaster />
      </ThemeProvider>
    ),
  ],
  title: "UI/Toaster",
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    const button = canvas.getByRole("button", { name: "Show Toast" });
    await userEvent.click(button);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("Query saved")).toBeInTheDocument();
  },
  render: () => (
    <Button variant="outline" onClick={() => toast("Query saved")}>
      Show Toast
    </Button>
  ),
};

export const Success: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Success Toast" })
    );
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByText("Connection established")
    ).toBeInTheDocument();
  },
  render: () => (
    <Button
      variant="outline"
      onClick={() => toast.success("Connection established")}
    >
      Success Toast
    </Button>
  ),
};

export const Error: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Error Toast" }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByText("Query execution failed")
    ).toBeInTheDocument();
  },
  render: () => (
    <Button
      variant="outline"
      onClick={() => toast.error("Query execution failed")}
    >
      Error Toast
    </Button>
  ),
};

export const WithDescription: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Toast with Description" })
    );
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("Query completed")).toBeInTheDocument();
    await expect(
      body.getByText("Returned 42 rows in 0.3s")
    ).toBeInTheDocument();
  },
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        toast("Query completed", {
          description: "Returned 42 rows in 0.3s",
        })
      }
    >
      Toast with Description
    </Button>
  ),
};

export const AllTypes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast("Default toast")}>
        Default
      </Button>
      <Button variant="outline" onClick={() => toast.success("Success toast")}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.error("Error toast")}>
        Error
      </Button>
      <Button variant="outline" onClick={() => toast.warning("Warning toast")}>
        Warning
      </Button>
      <Button variant="outline" onClick={() => toast.info("Info toast")}>
        Info
      </Button>
    </div>
  ),
  tags: ["!autodocs"],
};
