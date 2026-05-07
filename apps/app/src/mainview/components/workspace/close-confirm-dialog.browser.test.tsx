import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { CloseConfirmDialog } from "./close-confirm-dialog";

describe("close-confirm-dialog", () => {
  it("does not render content when open is false", () => {
    const screen = render(
      <CloseConfirmDialog
        dirtyCount={2}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={false}
      />
    );
    expect(screen.getByText(/Unsaved changes/).query()).toBeNull();
  });

  it("renders title and pluralized message when multiple tabs are dirty", () => {
    const screen = render(
      <CloseConfirmDialog
        dirtyCount={3}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
      />
    );
    expect(screen.getByText(/Unsaved changes/)).toBeVisible();
    expect(screen.getByText(/3 tabs with unexecuted changes/)).toBeVisible();
  });

  it("uses singular wording for one dirty tab", () => {
    const screen = render(
      <CloseConfirmDialog
        dirtyCount={1}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
      />
    );
    expect(screen.getByText(/1 tab with unexecuted changes/)).toBeVisible();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    const screen = render(
      <CloseConfirmDialog
        dirtyCount={1}
        onCancel={onCancel}
        onConfirm={vi.fn()}
        open
      />
    );
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when Close anyway is clicked", async () => {
    const onConfirm = vi.fn();
    const screen = render(
      <CloseConfirmDialog
        dirtyCount={1}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        open
      />
    );
    await screen.getByRole("button", { name: "Close anyway" }).click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
