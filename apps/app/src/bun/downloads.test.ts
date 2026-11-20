import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDownloads, slugBaseName, writeExclusive } from "./downloads.ts";

const setup = (dir: string) => {
  const reveal = vi.fn();
  const downloads = createDownloads({ dir: () => dir, reveal, writeExclusive });
  return { downloads, reveal };
};

const csv = (baseName: string, content = "a,b\n1,2") => ({
  baseName,
  content,
  extension: "csv",
});

describe("downloads", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "conch-downloads-"));
  });

  afterEach(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  it("writes the file under the downloads directory", async () => {
    const { downloads } = setup(dir);
    const saved = await downloads.save(csv("revenue-by-region"), ["csv"]);
    expect(saved.fileName).toBe("revenue-by-region.csv");
    await expect(readFile(join(dir, saved.fileName), "utf8")).resolves.toBe(
      "a,b\n1,2"
    );
  });

  it("adds -2, -3 instead of overwriting an existing file", async () => {
    const { downloads } = setup(dir);
    await writeFile(join(dir, "report.csv"), "keep me");
    const second = await downloads.save(csv("report"), ["csv"]);
    const third = await downloads.save(csv("report"), ["csv"]);
    expect([second.fileName, third.fileName]).toStrictEqual([
      "report-2.csv",
      "report-3.csv",
    ]);
    await expect(readFile(join(dir, "report.csv"), "utf8")).resolves.toBe(
      "keep me"
    );
  });

  it("re-slugs the name so it can never leave the directory", async () => {
    const { downloads } = setup(dir);
    const saved = await downloads.save(csv("../../etc/Passwd"), ["csv"]);
    expect(saved.fileName).toBe("etc-passwd.csv");
  });

  it.each([
    ["an empty name", csv("—")],
    ["an unknown extension", { ...csv("ok"), extension: "sh" }],
    ["content over 20 MB", csv("big", "x".repeat(20 * 1024 * 1024 + 1))],
  ])("rejects %s", async (_label, request) => {
    const { downloads } = setup(dir);
    await expect(downloads.save(request, ["csv"])).rejects.toMatchObject({
      code: "INVALID_FILE",
    });
  });

  it("rejects an extension the caller did not allow", async () => {
    const { downloads } = setup(dir);
    await expect(
      downloads.save({ ...csv("board"), extension: "conch.json" }, ["csv"])
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("propagates write errors other than an existing file", async () => {
    const reveal = vi.fn();
    const downloads = createDownloads({
      dir: () => dir,
      reveal,
      writeExclusive: vi.fn().mockRejectedValue(new Error("disk full")),
    });
    await expect(downloads.save(csv("x"), ["csv"])).rejects.toThrow(
      "disk full"
    );
  });

  it("reveals only files it saved", async () => {
    const { downloads, reveal } = setup(dir);
    const saved = await downloads.save(csv("revealed"), ["csv"]);
    downloads.reveal(saved.savedId);
    expect(reveal).toHaveBeenCalledWith(join(dir, "revealed.csv"));
    expect(() => downloads.reveal("unknown")).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" })
    );
  });

  it("forgets the oldest save after 20", async () => {
    const { downloads } = setup(dir);
    const first = await downloads.save(csv("first"), ["csv"]);
    for (let index = 0; index < 20; index += 1) {
      await downloads.save(csv(`file-${index}`), ["csv"]);
    }
    expect(() => downloads.reveal(first.savedId)).toThrow(
      "That file is no longer known."
    );
  });
});

describe("slugBaseName", () => {
  it("lower-cases and joins words with dashes", () => {
    expect(slugBaseName("  MRR by Region ")).toBe("mrr-by-region");
  });
});
