import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, userEvent, within } from "storybook/test";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  component: Dialog,
  title: "UI/Dialog",
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvasElement.querySelector(
      "[data-slot='dialog-trigger']"
    ) as HTMLElement;
    await userEvent.click(trigger);
    await expect(await body.findByText("New Connection")).toBeInTheDocument();
    await expect(
      body.getByText("Add a new database connection to your workspace.")
    ).toBeInTheDocument();
  },
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open Dialog</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Connection</DialogTitle>
          <DialogDescription>
            Add a new database connection to your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="host">Host</Label>
            <Input id="host" placeholder="localhost" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="port">Port</Label>
            <Input id="port" placeholder="5432" />
          </div>
        </div>
        <DialogFooter>
          <Button>Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithFooterClose: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline">Confirm Action</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the
            connection and all associated query history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithoutCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline">Minimal Dialog</Button>}
      />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Notice</DialogTitle>
          <DialogDescription>
            Click outside to dismiss this dialog.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
};
