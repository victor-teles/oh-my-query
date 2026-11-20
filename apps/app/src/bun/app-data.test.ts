import { migrateLegacyAppDir } from "@conch/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { migrateAppData } from "./app-data.ts";

vi.mock(import("@conch/core"), async (importOriginal) => ({
  ...(await importOriginal()),
  migrateLegacyAppDir: vi.fn(),
}));

describe("migrateAppData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves the legacy data folder", async () => {
    vi.mocked(migrateLegacyAppDir).mockResolvedValueOnce(true);

    await migrateAppData();

    expect(migrateLegacyAppDir).toHaveBeenCalledOnce();
  });

  it("logs and carries on when the move fails", async () => {
    const failure = new Error("EACCES");
    vi.mocked(migrateLegacyAppDir).mockRejectedValueOnce(failure);
    const log = vi.spyOn(console, "error").mockReturnValue();

    await expect(migrateAppData()).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(
      "[app-data] could not move the legacy data folder",
      failure
    );
  });
});
