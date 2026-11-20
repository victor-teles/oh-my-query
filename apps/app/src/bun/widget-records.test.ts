import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-v1-records-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const {
  decryptLine,
  encryptLine,
  recentAsksPath,
  resetCryptoCache,
  setLegacyKeyLoader,
  widgetsPath,
} = await import("@conch/core");
const { defaultRecentAskStore, defaultWidgetStore } =
  await import("./widget-service.ts");
const { RecentAsk } = await import("@conch/rpc");

const V1_SPEC = {
  formats: { mrr: { currency: "USD", kind: "currency" } },
  insight: "Europe grew every month.",
  title: "Monthly recurring revenue by region",
  version: 1,
  view: {
    groupBy: "region",
    kind: "chart",
    mark: "line",
    stacked: false,
    x: "month",
    y: ["mrr"],
  },
};

const V1_WIDGET = {
  connectionId: "conn-analytics",
  createdAt: "2026-11-18T09:00:00.000Z",
  database: null,
  dialect: "postgresql",
  id: "w-revenue",
  lastRunAt: "2026-11-19T08:00:00.000Z",
  lastValues: { period: "lastQuarter" },
  name: "Revenue by region",
  params: [
    {
      default: "lastQuarter",
      label: "Period",
      name: "period",
      type: "dateRange",
    },
  ],
  prompt: "revenue by region",
  spec: V1_SPEC,
  sqlTemplate:
    "select month, region, mrr from mrr where month >= {{period.from}} and month < {{period.to}}",
  updatedAt: "2026-11-18T09:00:00.000Z",
  view: "line",
};

const V1_RECENT = {
  askedAt: "2026-11-19T10:00:00.000Z",
  connectionId: "conn-analytics",
  database: null,
  dialect: "postgresql",
  id: "4b0c2f61-8f4e-4a43-9a52-7d0c1d7a0e11",
  prompt: "Revenue by region",
  spec: V1_SPEC,
  sql: "select month, region, mrr from mrr order by month",
};

const writeEncrypted = async (file: string, records: unknown[]) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, await encryptLine(JSON.stringify(records)));
};

const readEncrypted = async (file: string): Promise<unknown> => {
  const line = await fs.readFile(file, "utf8");
  return JSON.parse(await decryptLine(line.trim()));
};

const versionsIn = async (file: string): Promise<unknown[]> => {
  const records = await readEncrypted(file);
  return Array.isArray(records)
    ? records.map(
        (record: { spec?: { version?: unknown } }) => record.spec?.version
      )
    : [];
};

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

describe("records saved before the CardSpec version bump", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(path.join(TMP_HOME, ".config"), {
      force: true,
      recursive: true,
    });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("loads a version 1 widget and rewrites it as version 2 on save", async () => {
    await writeEncrypted(widgetsPath(), [V1_WIDGET]);
    const store = defaultWidgetStore();

    const [loaded] = await store.listWidgets();
    expect(loaded).toMatchObject({
      id: "w-revenue",
      name: "Revenue by region",
      spec: { title: V1_SPEC.title, version: 2 },
    });
    await expect(versionsIn(widgetsPath())).resolves.toStrictEqual([1]);

    await store.updateWidget("w-revenue", (widget) => ({
      ...widget,
      lastRunAt: "2026-11-20T08:00:00.000Z",
    }));
    await expect(versionsIn(widgetsPath())).resolves.toStrictEqual([2]);
  });

  it("loads a version 1 recent ask and rewrites it as version 2 when asked again", async () => {
    await writeEncrypted(recentAsksPath(), [V1_RECENT]);
    const store = defaultRecentAskStore();

    const [loaded] = await store.listRecentAsks();
    expect(loaded).toMatchObject({
      dialect: "postgresql",
      id: V1_RECENT.id,
      spec: { version: 2 },
    });

    await store.pushRecentAsk(
      RecentAsk.parse({ ...V1_RECENT, askedAt: "2026-11-20T10:00:00Z" })
    );
    await expect(versionsIn(recentAsksPath())).resolves.toStrictEqual([2]);
  });

  it("keeps a MongoDB recent next to SQL ones", async () => {
    await writeEncrypted(recentAsksPath(), [
      V1_RECENT,
      {
        ...V1_RECENT,
        dialect: "mongodb",
        id: "mongo-1",
        prompt: "orders by status",
        sql: '{"collection":"orders","pipeline":[{"$limit":1}]}',
      },
    ]);
    const asks = await defaultRecentAskStore().listRecentAsks();
    expect(asks.map((ask) => ask.dialect)).toStrictEqual([
      "postgresql",
      "mongodb",
    ]);
  });
});
