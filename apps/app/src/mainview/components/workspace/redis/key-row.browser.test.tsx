import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { RedisKey } from "@/lib/tauri";

import { KeyRow } from "./key-row";

const sampleKey: RedisKey = {
  kind: "STRING",
  name: "users:1",
  size: 128,
  sizeUnit: "bytes",
  ttlSecs: 600,
};

describe("key-row", () => {
  it("renders the display name and type badge", () => {
    const screen = render(
      <KeyRow
        depth={0}
        displayName="display"
        isActive={false}
        onActivate={vi.fn()}
        redisKey={sampleKey}
      />
    );
    expect(screen.getByText("display")).toBeVisible();
    expect(screen.getByText("STR")).toBeVisible();
  });

  it("invokes onActivate with the key name when clicked", async () => {
    const onActivate = vi.fn();
    const screen = render(
      <KeyRow
        depth={0}
        displayName="1"
        isActive={false}
        onActivate={onActivate}
        redisKey={sampleKey}
      />
    );
    await screen.getByRole("button").click();
    expect(onActivate).toHaveBeenCalledWith("users:1");
  });

  it("flags itself as active via data-active", () => {
    const screen = render(
      <KeyRow
        depth={1}
        displayName="1"
        isActive
        onActivate={vi.fn()}
        redisKey={sampleKey}
      />
    );
    expect(screen.getByRole("button").element()).toHaveAttribute("data-active");
  });
});
