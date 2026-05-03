import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

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

describe("dialog", () => {
  it("default", async () => {
    const screen = render(
      <Dialog>
        <DialogTrigger
          render={<Button variant="outline">Open Dialog</Button>}
        />
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
    );
    await screen.getByRole("button", { name: "Open Dialog" }).click();
    expect(page.getByText("New Connection")).toBeInTheDocument();
    expect(
      page.getByText("Add a new database connection to your workspace.")
    ).toBeInTheDocument();
    await expect(page.getByRole("dialog").element()).toMatchSnapshot();
  });

  it("withFooterClose", async () => {
    const screen = render(
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
    );
    await screen.getByRole("button", { name: "Confirm Action" }).click();
    expect(page.getByRole("dialog")).toBeVisible();
    expect(page.getByRole("dialog").element()).toMatchSnapshot();
  });

  it("withoutCloseButton", async () => {
    const screen = render(
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
    );
    await screen.getByRole("button", { name: "Minimal Dialog" }).click();
    expect(page.getByRole("dialog")).toBeVisible();
    expect(page.getByRole("dialog").element()).toMatchSnapshot();
  });
});
