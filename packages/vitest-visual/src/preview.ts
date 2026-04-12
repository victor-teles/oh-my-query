interface VisualRegressionReport {
  type: "visual";
  version: 1;
  result: {
    status: "pass" | "fail" | "new";
    diffPixels: number;
    diffPercent: number;
    message: string;
  };
  status: "passed" | "failed";
}

interface AfterEachContext {
  id: string;
  canvasElement?: HTMLElement;
  reporting: {
    addReport(report: VisualRegressionReport): void;
  };
  parameters: Record<string, unknown>;
}

interface BrowserPage {
  elementLocator(element: HTMLElement): {
    screenshot(opts: { base64: true }): Promise<{ base64: string }>;
  };
}

interface BrowserCommands {
  compareVisualSnapshot(
    id: string,
    base64: string,
    snapshotDir: string,
    threshold: number,
    failThreshold: number
  ): Promise<VisualRegressionReport["result"]>;
}

interface BrowserContext {
  page: BrowserPage;
  commands: BrowserCommands;
}

declare global {
  var __VITEST_VISUAL_BROWSER_CONTEXT__: BrowserContext | undefined;
}

function delay(ms: number): Promise<void> {
  // eslint-disable-next-line promise/avoid-new, promise/param-names, no-promise-executor-return, no-void -- setTimeout needs a raw promise
  return new Promise<void>((r) => void setTimeout(r, ms));
}

async function waitForStability(
  element: HTMLElement,
  timeout: number
): Promise<void> {
  const animations = element.getAnimations({ subtree: true });
  if (animations.length > 0) {
    await Promise.race([
      Promise.allSettled(animations.map((a) => a.finished)),
      delay(timeout),
    ]);
    return;
  }

  await delay(100);
}

export const afterEach = async (context: AfterEachContext) => {
  const ctx = globalThis.__VITEST_VISUAL_BROWSER_CONTEXT__;
  if (!ctx) {
    return;
  }

  const { id, canvasElement, reporting, parameters } = context;
  if (!canvasElement) {
    return;
  }

  const vr = (parameters?.visualRegression ?? {}) as Record<string, unknown>;
  if (vr.disable === true) {
    return;
  }

  const snapshotDir = (vr.snapshotDir as string) ?? ".storybook/snapshots";
  const threshold = (vr.threshold as number) ?? 0.2;
  const failThreshold = (vr.failThreshold as number) ?? 0.03;
  const stabilityTimeout = (vr.stabilityTimeout as number) ?? 1000;

  await waitForStability(canvasElement, stabilityTimeout);

  const locator = ctx.page.elementLocator(canvasElement);
  const { base64 } = await locator.screenshot({ base64: true });

  const result = await ctx.commands.compareVisualSnapshot(
    id,
    base64,
    snapshotDir,
    threshold,
    failThreshold
  );

  reporting.addReport({
    result,
    status: result.status === "fail" ? "failed" : "passed",
    type: "visual",
    version: 1,
  });

  if (result.status === "fail") {
    throw new Error(`Visual regression: ${result.message}`);
  }
};
