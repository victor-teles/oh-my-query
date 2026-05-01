import type { Meta, StoryObj } from "@storybook/react-vite";

import { MotionConfig } from "motion/react";
import { expect, fn } from "storybook/test";

import type {
  IslandSnapshot,
  RunningQueryEntry,
} from "@/contexts/island-context";

import { DynamicIslandContent } from "./dynamic-island-content";

const makeRunner = (
  overrides: Partial<RunningQueryEntry> = {}
): RunningQueryEntry => ({
  connectionColor: undefined,
  connectionEmoji: undefined,
  connectionEnvironment: undefined,
  connectionId: "conn-1",
  connectionLabel: "analytics-db",
  onCancel: fn(),
  startedAt: Date.now() - 2400,
  tabId: "tab-1",
  tabTitle: "Top users",
  ...overrides,
});

const makeRunningSnapshot = (runners: RunningQueryEntry[]): IslandSnapshot => ({
  headlineTabId: runners[0]?.tabId ?? "",
  kind: "query-running",
  onCancelAll: fn(),
  onCancelHeadline: runners[0]?.onCancel ?? fn(),
  runners,
});

const IslandShell = ({ snapshot }: { snapshot: IslandSnapshot }) => (
  <div className="flex items-center justify-center p-8">
    <div
      className="
        relative flex h-6 items-center gap-1.5 rounded-full border
        border-border/60 bg-background/85 px-2.5 shadow-sm backdrop-blur-xl
        backdrop-saturate-200
      "
    >
      <DynamicIslandContent snapshot={snapshot} />
    </div>
  </div>
);

const meta = {
  component: IslandShell,
  parameters: {
    backgrounds: { default: "dark" },
    layout: "centered",
  },
  title: "Titlebar/DynamicIsland",
} satisfies Meta<typeof IslandShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Welcome: Story = {
  args: {
    snapshot: { kind: "welcome" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Welcome")).toBeInTheDocument();
  },
};

export const Ambient: Story = {
  args: {
    snapshot: { connectionName: "my-db", kind: "ambient" },
  },
};

export const Connecting: Story = {
  args: {
    snapshot: { connectionName: "production-pg", kind: "connecting" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/production-pg/i)).toBeInTheDocument();
  },
};

export const Reconnecting: Story = {
  args: {
    snapshot: { connectionName: "staging-pg", kind: "reconnecting" },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText(/Reconnecting to staging-pg/i)
    ).toBeInTheDocument();
  },
};

export const ConnectionError: Story = {
  args: {
    snapshot: {
      error: "ECONNREFUSED: Connection refused at 127.0.0.1:5432",
      kind: "connection-error",
      onReconnect: fn(),
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /retry/i })).toBeVisible();
  },
};

export const ConnectedIdle: Story = {
  args: {
    snapshot: {
      color: "honey",
      connectionName: "analytics-db",
      database: "analytics",
      emoji: "🐝",
      environment: "prod",
      kind: "connected-idle",
      serverVersion: "16.2",
      username: "admin",
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: /Connected to analytics-db/i })
    ).toBeVisible();
  },
};

export const ConnectedIdleNoEnv: Story = {
  args: {
    snapshot: {
      color: "denim",
      connectionName: "local-dev",
      database: "myapp_dev",
      emoji: undefined,
      environment: undefined,
      kind: "connected-idle",
      serverVersion: null,
      username: "postgres",
    },
  },
};

export const QueryRunningSingle: Story = {
  args: {
    snapshot: makeRunningSnapshot([
      makeRunner({ startedAt: Date.now() - 4200 }),
    ]),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Running")).toBeInTheDocument();
  },
};

export const QueryRunningThree: Story = {
  args: {
    snapshot: makeRunningSnapshot([
      makeRunner({
        connectionEnvironment: "prod",
        connectionLabel: "analytics-db",
        startedAt: Date.now() - 12_400,
        tabId: "t1",
        tabTitle: "Top users",
      }),
      makeRunner({
        connectionColor: "denim",
        connectionLabel: "billing-db",
        startedAt: Date.now() - 4500,
        tabId: "t2",
        tabTitle: "Recent invoices",
      }),
      makeRunner({
        connectionColor: "moss",
        connectionEnvironment: "staging",
        connectionLabel: "search-staging",
        startedAt: Date.now() - 1100,
        tabId: "t3",
        tabTitle: "Index rebuild",
      }),
    ]),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("+2")).toBeVisible();
  },
};

export const QueryRunningOverflow: Story = {
  args: {
    snapshot: makeRunningSnapshot(
      Array.from({ length: 6 }, (_, i) =>
        makeRunner({
          connectionLabel: `db-${i + 1}`,
          startedAt: Date.now() - (i + 1) * 2300,
          tabId: `t${i + 1}`,
          tabTitle: `Long-running query ${i + 1}`,
        })
      )
    ),
  },
};

export const QueryRunningReducedMotion: Story = {
  args: {
    snapshot: makeRunningSnapshot([
      makeRunner({ startedAt: Date.now() - 3300, tabId: "t1" }),
      makeRunner({ startedAt: Date.now() - 1100, tabId: "t2" }),
    ]),
  },
  decorators: [
    (Story) => (
      <MotionConfig reducedMotion="always">
        <Story />
      </MotionConfig>
    ),
  ],
};

export const QueryStreaming: Story = {
  args: {
    snapshot: { kind: "query-streaming", tokensReceived: 128 },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Streaming")).toBeInTheDocument();
  },
};

export const QueryStreamingStart: Story = {
  args: {
    snapshot: { kind: "query-streaming", tokensReceived: 0 },
  },
};

export const QueryPlanning: Story = {
  args: {
    snapshot: { kind: "query-planning" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Planning…")).toBeInTheDocument();
  },
};

export const QueryCancelled: Story = {
  args: {
    snapshot: { kind: "query-cancelled" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Cancelled")).toBeInTheDocument();
  },
};

export const QuerySuccess: Story = {
  args: {
    snapshot: { executionTimeMs: 142, kind: "query-success", rowCount: 2847 },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("2847")).toBeInTheDocument();
    await expect(canvas.getByText("142ms")).toBeInTheDocument();
  },
};

export const QuerySuccessSlow: Story = {
  args: {
    snapshot: { executionTimeMs: 3200, kind: "query-success", rowCount: 1 },
  },
};

export const QueryError: Story = {
  args: {
    snapshot: {
      error:
        'ERROR: column "user_idz" does not exist at character 8 (SQLSTATE 42703)',
      kind: "query-error",
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Query failed:")).toBeInTheDocument();
  },
};

export const AllStates: Story = {
  args: { snapshot: { kind: "welcome" } },
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-3">
      {(
        [
          { kind: "welcome" },
          { connectionName: "local-dev", kind: "ambient" },
          { connectionName: "production-pg", kind: "connecting" },
          { connectionName: "staging-pg", kind: "reconnecting" },
          {
            error: "ECONNREFUSED at 127.0.0.1:5432",
            kind: "connection-error",
            onReconnect: fn(),
          },
          {
            color: "honey",
            connectionName: "analytics-db",
            database: "analytics",
            emoji: "🐝",
            environment: "prod",
            kind: "connected-idle",
            serverVersion: "16.2",
            username: "admin",
          },
          makeRunningSnapshot([makeRunner({ startedAt: Date.now() - 2400 })]),
          { kind: "query-streaming", onCancel: fn(), tokensReceived: 128 },
          { kind: "query-planning", onCancel: fn() },
          { kind: "query-cancelled" },
          { executionTimeMs: 142, kind: "query-success", rowCount: 2847 },
          {
            error: 'column "user_idz" does not exist',
            kind: "query-error",
          },
        ] satisfies IslandSnapshot[]
      ).map((snapshot) => (
        <div className="flex items-center gap-4" key={snapshot.kind}>
          <span
            className="
              text-data w-36 text-right text-[10px] text-muted-foreground/50
            "
          >
            {snapshot.kind}
          </span>
          <div
            className="
              flex h-6 items-center gap-1.5 rounded-full border border-border/60
              bg-background/85 px-2.5 shadow-sm backdrop-blur-xl
              backdrop-saturate-200
            "
          >
            <DynamicIslandContent snapshot={snapshot} />
          </div>
        </div>
      ))}
    </div>
  ),
  tags: ["!autodocs"],
};
