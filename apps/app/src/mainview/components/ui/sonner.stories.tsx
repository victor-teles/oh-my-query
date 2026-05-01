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

export const ConnectionDeletedUndo: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete connection" })
    );
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByText('"Production" deleted')
    ).toBeInTheDocument();
    await expect(
      body.getByRole("button", { name: "Undo" })
    ).toBeInTheDocument();
  },
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        toast('"Production" deleted', {
          action: {
            label: "Undo",
            onClick: () => {
              // story stub: real handler would restore the connection
            },
          },
          duration: 5000,
        })
      }
    >
      Delete connection
    </Button>
  ),
};
