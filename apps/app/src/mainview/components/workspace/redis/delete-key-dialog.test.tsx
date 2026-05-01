import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => {
      // resolves with void
    });
    const onClose = vi.fn();

    render(
      <DeleteKeyDialog
        dbIndex={0}
        onClose={onClose}
        onConfirm={onConfirm}
        redisKey={sampleKey}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledWith("user:42");
    expect(onClose).toHaveBeenCalledWith();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders an inline alert and stays open when delete fails", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("button", { name: "Delete" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("WRONGTYPE error");
    expect(onClose).not.toHaveBeenCalled();
  });
});
