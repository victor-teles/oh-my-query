import { CopyIcon, PencilIcon, TrashIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "./context-menu";

describe("context-menu", () => {
  it("default", async () => {
    const screen = render(
      <ContextMenu>
        <ContextMenuTrigger
          className="
            flex h-32 w-72 items-center justify-center rounded-md border
            border-dashed text-xs text-muted-foreground
          "
        >
          Right click here
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>
            <CopyIcon />
            Copy
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <PencilIcon />
            Edit
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">
            <TrashIcon />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    await expect.element(screen.getByText("Right click here")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
