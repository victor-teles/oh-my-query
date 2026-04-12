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
  // Set by the vitest-visual setup file; absent in Storybook dev.
  var __VITEST_VISUAL_BROWSER_CONTEXT__: BrowserContext | undefined;
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
  const failThreshold = (vr.failThreshold as number) ?? 0.01;

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
