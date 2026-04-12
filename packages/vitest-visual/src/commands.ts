import type { BrowserCommand } from "vitest/node";

import fs from "node:fs";
import path from "node:path";

import type { CompareResult } from "./types.ts";

type CompareArgs = [
  snapshotName: string,
  screenshotBase64: string,
  snapshotDir: string,
  threshold: number,
  failThreshold: number,
];

export const compareVisualSnapshot: BrowserCommand<CompareArgs> = async (
  ctx,
  snapshotName,
  screenshotBase64,
  snapshotDir,
  threshold,
  failThreshold
) => {
  const pngjs = await import("pngjs");
  const { PNG } = pngjs;
  const pixelmatchModule = await import("pixelmatch");
  const pixelmatch = pixelmatchModule.default;

  const rootDir = ctx.project.config.root;
  const resolved = path.resolve(rootDir, snapshotDir);
  const baselinePath = path.join(resolved, `${snapshotName}.png`);
  const actualPath = path.join(resolved, "__actual__", `${snapshotName}.png`);
  const diffPath = path.join(resolved, "__diff__", `${snapshotName}.png`);

  const actualBuffer = Buffer.from(screenshotBase64, "base64");

  if (!fs.existsSync(baselinePath)) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, actualBuffer);
    return {
      diffPercent: 0,
      diffPixels: 0,
      message: `New baseline created: ${snapshotName}`,
      status: "new",
    } satisfies CompareResult;
  }

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const actual = PNG.sync.read(actualBuffer);

  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    fs.mkdirSync(path.dirname(actualPath), { recursive: true });
    fs.writeFileSync(actualPath, actualBuffer);
    return {
      diffPercent: 1,
      diffPixels: baseline.width * baseline.height,
      message: `Size mismatch: expected ${baseline.width}x${baseline.height}, got ${actual.width}x${actual.height}`,
      status: "fail",
    } satisfies CompareResult;
  }

  const diff = new PNG({ height: baseline.height, width: baseline.width });
  const diffPixels = pixelmatch(
    baseline.data,
    actual.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold }
  );

  const totalPixels = baseline.width * baseline.height;
  const diffPercent = totalPixels > 0 ? diffPixels / totalPixels : 0;
  const passed = diffPercent <= failThreshold;

  if (!passed) {
    fs.mkdirSync(path.dirname(actualPath), { recursive: true });
    fs.mkdirSync(path.dirname(diffPath), { recursive: true });
    fs.writeFileSync(actualPath, actualBuffer);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  return {
    diffPercent,
    diffPixels,
    message:
      diffPixels > 0
        ? `${diffPixels} pixels differ (${(diffPercent * 100).toFixed(2)}%)`
        : "Match",
    status: passed ? "pass" : "fail",
  } satisfies CompareResult;
};

type UpdateArgs = [
  snapshotName: string,
  screenshotBase64: string,
  snapshotDir: string,
];

export const updateVisualBaseline: BrowserCommand<UpdateArgs> = (
  _ctx,
  snapshotName,
  screenshotBase64,
  snapshotDir
) => {
  const baselinePath = path.join(snapshotDir, `${snapshotName}.png`);
  const buffer = Buffer.from(screenshotBase64, "base64");

  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, buffer);
  return { message: `Baseline updated: ${snapshotName}`, success: true };
};
