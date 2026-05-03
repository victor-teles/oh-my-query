import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import type { RedisKey } from "@/lib/tauri";

import { DeleteKeyDialog } from "./delete-key-dialog";

const sampleKey: RedisKey = {
  kind: "STRING",
  name: "user:42",
  size: 1,
  sizeUnit: "bytes",
  ttlSecs: null,
};

describe("deleteKeyDialog", () => {
  it("closes silently after a successful delete", async () => {
    const onConfirm = vi.fn(async () => {
      // resolves with void
    });
    const onClose = vi.fn();

    const screen = render(
      <DeleteKeyDialog
        dbIndex={0}
        onClose={onClose}
        onConfirm={onConfirm}
        redisKey={sampleKey}
      />
    );

    await page.getByRole("button", { name: "Delete" }).click();

    expect(onConfirm).toHaveBeenCalledWith("user:42");
    expect(onClose).toHaveBeenCalledWith();
    expect(screen.getByRole("alert").query()).toBeNull();
  });

  it("renders an inline alert and stays open when delete fails", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("WRONGTYPE error"));
    const onClose = vi.fn();

    render(
      <DeleteKeyDialog
        dbIndex={0}
        onClose={onClose}
        onConfirm={onConfirm}
        redisKey={sampleKey}
      />
    );

    await page.getByRole("button", { name: "Delete" }).click();

    const alert = page.getByRole("alert");
    await expect.element(alert).toBeInTheDocument();
    expect(alert.element().textContent).toContain("WRONGTYPE error");
    expect(onClose).not.toHaveBeenCalled();
  });
});
